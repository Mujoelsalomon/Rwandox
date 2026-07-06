import os
import re
import time
import joblib
import json
import math
import random
import pandas as pd
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.base import BaseEstimator, ClassifierMixin, clone
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    fbeta_score,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, OrdinalEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.calibration import CalibratedClassifierCV, calibration_curve

from metric_benchmarks import enrich_metric_benchmarks

# Import common sklearn estimators
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.linear_model import SGDClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.naive_bayes import GaussianNB

try:
    import xgboost as xgb
except Exception:
    xgb = None

try:
    import lightgbm as lgb
except Exception:
    lgb = None

try:
    import torch
    import torch.nn as nn
except Exception:
    torch = None
    nn = None

try:
    from imblearn.over_sampling import SMOTENC
except Exception:
    SMOTENC = None

MAX_CATEGORICAL_UNIQUE_VALUES = int(os.getenv("TRAINING_MAX_CATEGORICAL_UNIQUE_VALUES", "80"))
# Set TRAINING_MAX_ROWS to a positive number only when local training needs an
# explicit cap. By default, every cleaned dataset row is available for training.
MAX_LOCAL_TRAINING_ROWS = int(os.getenv("TRAINING_MAX_ROWS", "0"))
TAB_TRANSFORMER_MAX_ROWS = int(os.getenv("TRAINING_TAB_TRANSFORMER_MAX_ROWS", "0"))
TRAINING_RANDOM_SEED = int(os.getenv("TRAINING_RANDOM_SEED", "42"))
LARGE_DATASET_ROW_COUNT = int(os.getenv("TRAINING_LARGE_DATASET_ROWS", "5000"))
PERMUTATION_IMPORTANCE_MAX_ROWS = int(os.getenv("TRAINING_PERMUTATION_IMPORTANCE_MAX_ROWS", "1200"))
MIN_THRESHOLD_SPECIFICITY = float(os.getenv("TRAINING_MIN_THRESHOLD_SPECIFICITY", "0.05"))
MIN_THRESHOLD_PREDICTED_NEGATIVE_RATE = float(os.getenv("TRAINING_MIN_THRESHOLD_PREDICTED_NEGATIVE_RATE", "0.01"))


def read_dataset(dataset_path: str, **kwargs) -> pd.DataFrame:
    """Read a training dataset from a supported tabular file."""
    extension = os.path.splitext(str(dataset_path))[1].lower()
    if extension == ".xlsx":
        try:
            return drop_fully_empty_rows(pd.read_excel(dataset_path, engine="openpyxl", **kwargs))
        except ImportError as exc:
            raise RuntimeError(
                "Excel XLSX support is not active in the running backend. Install backend requirements, "
                "restart the backend server, and upload the dataset again."
            ) from exc
    if extension == ".xls":
        try:
            return drop_fully_empty_rows(pd.read_excel(dataset_path, engine="xlrd", **kwargs))
        except ImportError as exc:
            raise RuntimeError(
                "Excel XLS support is not active in the running backend. Install backend requirements, "
                "restart the backend server, and upload the dataset again."
            ) from exc
    if extension in {".tsv", ".tab"}:
        return drop_fully_empty_rows(pd.read_csv(dataset_path, sep="\t", low_memory=False, **kwargs))
    if extension == ".jsonl":
        return drop_fully_empty_rows(pd.read_json(dataset_path, lines=True, **kwargs))
    if extension == ".json":
        return drop_fully_empty_rows(pd.read_json(dataset_path, **kwargs))
    return drop_fully_empty_rows(pd.read_csv(dataset_path, low_memory=False, **kwargs))


def drop_fully_empty_rows(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    return df.dropna(how="all")


def dataset_columns(dataset_path: str) -> list[str]:
    df = read_dataset(dataset_path, nrows=0)
    return [str(column) for column in df.columns]


def default_target_column(columns) -> str:
    preferred_targets = {
        "postop_oxygen_required",
        "postoperative_oxygen_required",
        "oxygen_required",
        "oxygen_requirement",
        "requires_oxygen",
        "target",
        "label",
        "outcome",
    }
    for column in columns:
        if normalize_column_name(column) in preferred_targets:
            return column
    return columns[-1]


def clean_training_dataset(df: pd.DataFrame, target_column: str = None) -> tuple[pd.DataFrame, str, dict]:
    """Resolve common upload issues before model training."""
    report = {
        "original_row_count": int(len(df)),
        "original_column_count": int(len(df.columns)),
        "final_row_count": 0,
        "final_column_count": 0,
        "renamed_columns": [],
        "dropped_empty_columns": [],
        "dropped_empty_row_count": 0,
        "dropped_missing_target_row_count": 0,
        "trimmed_text_cell_count": 0,
        "blank_text_values_converted_to_missing": 0,
        "infinite_values_converted_to_missing": 0,
        "numeric_text_columns_converted": [],
        "notes": [],
    }

    cleaned = df.copy()
    cleaned.columns = make_unique_column_names(cleaned.columns, report)

    target_column = resolve_target_column(cleaned.columns, target_column)
    if target_column is None:
        target_column = default_target_column(cleaned.columns)

    if cleaned.empty:
        raise ValueError("dataset is empty")

    empty_rows = cleaned.isna().all(axis=1)
    report["dropped_empty_row_count"] = int(empty_rows.sum())
    if report["dropped_empty_row_count"]:
        cleaned = cleaned.loc[~empty_rows].copy()

    empty_columns = [column for column in cleaned.columns if cleaned[column].isna().all()]
    if empty_columns:
        if target_column in empty_columns:
            raise ValueError(f"target column '{target_column}' is empty")
        report["dropped_empty_columns"] = [str(column) for column in empty_columns]
        cleaned = cleaned.drop(columns=empty_columns)

    if target_column not in cleaned.columns:
        raise ValueError(f"target column '{target_column}' not found in dataset")

    missing_target = cleaned[target_column].isna()
    report["dropped_missing_target_row_count"] = int(missing_target.sum())
    if report["dropped_missing_target_row_count"]:
        cleaned = cleaned.loc[~missing_target].copy()

    if cleaned.empty:
        raise ValueError("dataset has no rows after cleaning missing target values")

    object_columns = cleaned.select_dtypes(include=["object", "string"]).columns.tolist()
    for column in object_columns:
        series = cleaned[column]
        non_missing = series.notna()
        stripped = series.where(~non_missing, series.astype(str).str.strip())
        report["trimmed_text_cell_count"] += int((series[non_missing].astype(str) != stripped[non_missing]).sum())
        blank_mask = stripped.isin(["", "nan", "NaN", "none", "None", "null", "NULL"])
        report["blank_text_values_converted_to_missing"] += int(blank_mask.sum())
        cleaned[column] = stripped.mask(blank_mask, pd.NA)

    inf_mask = cleaned.map(lambda value: isinstance(value, (int, float, np.number)) and not np.isfinite(value))
    report["infinite_values_converted_to_missing"] = int(inf_mask.to_numpy().sum())
    if report["infinite_values_converted_to_missing"]:
        cleaned = cleaned.mask(inf_mask, pd.NA)

    for column in [item for item in cleaned.columns if item != target_column]:
        if not pd.api.types.is_object_dtype(cleaned[column]) and not pd.api.types.is_string_dtype(cleaned[column]):
            continue
        converted = numeric_text_series(cleaned[column])
        if converted is None:
            continue
        cleaned[column] = converted
        report["numeric_text_columns_converted"].append(str(column))

    report["final_row_count"] = int(len(cleaned))
    report["final_column_count"] = int(len(cleaned.columns))
    if report["renamed_columns"]:
        report["notes"].append("Column names were standardized before training.")
    if report["numeric_text_columns_converted"]:
        report["notes"].append("Numeric-looking text columns were converted to numbers.")
    if report["dropped_empty_columns"] or report["dropped_empty_row_count"]:
        report["notes"].append("Empty rows or columns were removed.")
    if report["dropped_missing_target_row_count"]:
        report["notes"].append("Rows without a target value were excluded from training.")
    if report["infinite_values_converted_to_missing"]:
        report["notes"].append("Infinite values were converted to missing values for imputation.")

    return cleaned, target_column, json_safe(report)


def make_unique_column_names(columns, report) -> list[str]:
    seen = {}
    cleaned_columns = []
    for index, original in enumerate(columns):
        base = str(original).strip() or f"column_{index + 1}"
        candidate = base
        suffix = 2
        while candidate in seen:
            candidate = f"{base}_{suffix}"
            suffix += 1
        seen[candidate] = True
        cleaned_columns.append(candidate)
        if candidate != str(original):
            report["renamed_columns"].append({"from": str(original), "to": candidate})
    return cleaned_columns


def resolve_target_column(columns, requested):
    if requested is None:
        return None
    requested = str(requested).strip()
    if not requested:
        return None
    column_list = list(columns)
    if requested in column_list:
        return requested
    lowered = requested.lower()
    normalized_requested = normalize_column_name(requested)
    for column in column_list:
        if str(column).lower() == lowered:
            return column
        if normalize_column_name(column) == normalized_requested:
            return column
    preferred_target_names = {
        "postop_oxygen_required",
        "postoperative_oxygen_required",
        "oxygen_required",
        "oxygen_requirement",
        "requires_oxygen",
        "target",
        "label",
        "outcome",
    }
    if normalized_requested in preferred_target_names:
        for column in column_list:
            if normalize_column_name(column) in preferred_target_names:
                return column
    return requested


def normalize_column_name(value):
    return re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower()).strip("_")


def numeric_text_series(series):
    non_missing = series.dropna()
    if non_missing.empty:
        return None
    normalized = non_missing.astype(str).str.replace(",", "", regex=False).str.replace("%", "", regex=False).str.strip()
    converted = pd.to_numeric(normalized, errors="coerce")
    success_ratio = converted.notna().mean()
    if success_ratio < 0.85:
        return None
    full_normalized = series.astype("string").str.replace(",", "", regex=False).str.replace("%", "", regex=False).str.strip()
    return pd.to_numeric(full_normalized, errors="coerce")


def dense_one_hot_encoder():
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:
        return OneHotEncoder(handle_unknown="ignore", sparse=False)


def categorical_ordinal_encoder():
    return OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)


class TabularTransformerNet(nn.Module if nn is not None else object):
    def __init__(self, n_features, n_classes, d_model=32, n_heads=4, n_layers=2, dropout=0.1):
        super().__init__()
        self.token_projection = nn.Linear(1, d_model)
        self.feature_embedding = nn.Parameter(torch.zeros(1, n_features, d_model))
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=d_model * 4,
            dropout=dropout,
            batch_first=True,
            activation="gelu",
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)
        self.head = nn.Sequential(
            nn.LayerNorm(d_model),
            nn.Linear(d_model, n_classes),
        )

    def forward(self, values):
        tokens = self.token_projection(values.unsqueeze(-1)) + self.feature_embedding
        encoded = self.encoder(tokens)
        return self.head(encoded.mean(dim=1))


class WeightedTorchMLPClassifier(ClassifierMixin, BaseEstimator):
    def __init__(self, hidden_units=64, max_epochs=25, batch_size=512, learning_rate=0.001, random_state=42):
        self.hidden_units = hidden_units
        self.max_epochs = max_epochs
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.random_state = random_state

    def fit(self, X, y):
        if torch is None or nn is None:
            raise RuntimeError("PyTorch is required for weighted MLP training. Install torch and restart the backend.")

        set_global_random_seed(self.random_state)
        X_array = np.asarray(X, dtype=np.float32)
        y_array = np.asarray(y, dtype=np.float32)
        if X_array.ndim != 2 or X_array.shape[1] == 0:
            raise ValueError("MLP training requires at least one feature column.")

        self.classes_ = np.array([0, 1])
        self.device_ = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_ = nn.Sequential(
            nn.Linear(X_array.shape[1], int(self.hidden_units)),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(int(self.hidden_units), 1),
        ).to(self.device_)

        negative_count = max(1, int((y_array == 0).sum()))
        positive_count = max(1, int((y_array == 1).sum()))
        pos_weight = torch.as_tensor([negative_count / positive_count], dtype=torch.float32, device=self.device_)
        criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
        optimizer = torch.optim.AdamW(self.model_.parameters(), lr=float(self.learning_rate))

        features = torch.as_tensor(X_array, dtype=torch.float32, device=self.device_)
        targets = torch.as_tensor(y_array.reshape(-1, 1), dtype=torch.float32, device=self.device_)
        batch_size = max(1, int(self.batch_size))

        self.model_.train()
        for _epoch in range(max(1, int(self.max_epochs))):
            order = torch.randperm(features.shape[0], device=self.device_)
            for start in range(0, features.shape[0], batch_size):
                batch_index = order[start:start + batch_size]
                optimizer.zero_grad(set_to_none=True)
                loss = criterion(self.model_(features[batch_index]), targets[batch_index])
                loss.backward()
                optimizer.step()

        return self

    def predict_proba(self, X):
        self.model_.eval()
        X_array = np.asarray(X, dtype=np.float32)
        features = torch.as_tensor(X_array, dtype=torch.float32, device=self.device_)
        probabilities = []
        batch_size = max(1, int(self.batch_size))
        with torch.no_grad():
            for start in range(0, features.shape[0], batch_size):
                logits = self.model_(features[start:start + batch_size])
                probabilities.append(torch.sigmoid(logits).cpu().numpy().reshape(-1))
        positive = np.concatenate(probabilities) if probabilities else np.array([])
        return np.column_stack([1 - positive, positive])

    def predict(self, X):
        return (self.predict_proba(X)[:, 1] >= 0.5).astype(int)


class ResampledKNNClassifier(ClassifierMixin, BaseEstimator):
    def __init__(self, n_neighbors=5, categorical_feature_indices=None, random_state=42):
        self.n_neighbors = n_neighbors
        self.categorical_feature_indices = categorical_feature_indices
        self.random_state = random_state

    def fit(self, X, y):
        X_array = np.asarray(X)
        y_array = np.asarray(y)
        self.classes_ = np.array([0, 1])
        categorical_indices = list(self.categorical_feature_indices or [])
        has_numeric = X_array.shape[1] > len(categorical_indices)
        has_categorical = bool(categorical_indices)

        if SMOTENC is not None and has_numeric and has_categorical and min(np.bincount(y_array, minlength=2)) > 1:
            sampler = SMOTENC(categorical_features=categorical_indices, random_state=int(self.random_state))
            X_fit, y_fit = sampler.fit_resample(X_array, y_array)
            self.resampling_method_ = "SMOTENC within training fold"
        else:
            X_fit, y_fit = random_oversample_minority(X_array, y_array, random_state=int(self.random_state))
            self.resampling_method_ = "Random minority oversampling within training fold"
            if has_numeric and has_categorical and SMOTENC is None:
                self.resampling_limitation_ = "SMOTENC is not installed; used fold-local random oversampling fallback."

        self.estimator_ = KNeighborsClassifier(n_neighbors=int(self.n_neighbors))
        self.estimator_.fit(X_fit, y_fit)
        return self

    def predict_proba(self, X):
        return self.estimator_.predict_proba(X)

    def predict(self, X):
        return self.estimator_.predict(X)


class TabTransformerClassifier(ClassifierMixin, BaseEstimator):
    def __init__(
        self,
        max_epochs=4,
        batch_size=2048,
        learning_rate=0.001,
        d_model=8,
        n_heads=2,
        n_layers=1,
        dropout=0.1,
        random_state=42,
        class_weight=None,
    ):
        self.max_epochs = max_epochs
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.d_model = d_model
        self.n_heads = n_heads
        self.n_layers = n_layers
        self.dropout = dropout
        self.random_state = random_state
        self.class_weight = class_weight

    def fit(self, X, y):
        if torch is None or nn is None:
            raise RuntimeError("PyTorch is required for Tab Transformer training. Install torch and restart the backend.")

        X_array = np.asarray(X, dtype=np.float32)
        if X_array.ndim != 2 or X_array.shape[1] == 0:
            raise ValueError("Tab Transformer training requires at least one feature column.")

        self.label_encoder_ = LabelEncoder()
        y_array = self.label_encoder_.fit_transform(pd.Series(y).astype(str))
        self.classes_ = self.label_encoder_.classes_
        if len(self.classes_) < 2:
            raise ValueError("Tab Transformer training requires at least two target classes.")

        torch.manual_seed(int(self.random_state))
        self.device_ = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_ = TabularTransformerNet(
            n_features=X_array.shape[1],
            n_classes=len(self.classes_),
            d_model=int(self.d_model),
            n_heads=int(self.n_heads),
            n_layers=int(self.n_layers),
            dropout=float(self.dropout),
        ).to(self.device_)

        features = torch.as_tensor(X_array, dtype=torch.float32, device=self.device_)
        targets = torch.as_tensor(y_array, dtype=torch.long, device=self.device_)
        class_counts = np.bincount(y_array, minlength=len(self.classes_)).astype(np.float32)
        class_weights = np.ones(len(self.classes_), dtype=np.float32)
        if self.class_weight:
            for label, weight in self.class_weight.items():
                class_weights[int(label)] = float(weight)
        elif len(self.classes_) == 2:
            class_weights[1] = class_counts[0] / max(class_counts[1], 1.0)
        weights = torch.as_tensor(class_weights, dtype=torch.float32, device=self.device_)
        optimizer = torch.optim.AdamW(self.model_.parameters(), lr=float(self.learning_rate))
        criterion = nn.CrossEntropyLoss(weight=weights)
        batch_size = max(1, int(self.batch_size))

        self.model_.train()
        for _epoch in range(max(1, int(self.max_epochs))):
            order = torch.randperm(features.shape[0], device=self.device_)
            for start in range(0, features.shape[0], batch_size):
                batch_index = order[start:start + batch_size]
                optimizer.zero_grad(set_to_none=True)
                loss = criterion(self.model_(features[batch_index]), targets[batch_index])
                loss.backward()
                optimizer.step()

        self.threshold_ = 0.5
        if len(self.classes_) == 2:
            train_probabilities = self.predict_proba(X_array)
            positive_index = self._positive_index()
            positive_scores = train_probabilities[:, positive_index]
            best_score = -1.0
            best_threshold = 0.5
            for threshold in np.linspace(0.2, 0.8, 25):
                candidate = (positive_scores >= threshold).astype(int)
                score = balanced_accuracy_score(y_array == positive_index, candidate)
                if score > best_score:
                    best_score = score
                    best_threshold = float(threshold)
            self.threshold_ = best_threshold

        return self

    def predict_proba(self, X):
        self.model_.eval()
        X_array = np.asarray(X, dtype=np.float32)
        features = torch.as_tensor(X_array, dtype=torch.float32, device=self.device_)
        probabilities = []
        batch_size = max(1, int(self.batch_size))
        with torch.no_grad():
            for start in range(0, features.shape[0], batch_size):
                logits = self.model_(features[start:start + batch_size])
                probabilities.append(torch.softmax(logits, dim=1).cpu().numpy())
        return np.vstack(probabilities)

    def predict(self, X):
        probabilities = self.predict_proba(X)
        if len(self.classes_) == 2:
            positive_index = self._positive_index()
            negative_index = 1 - positive_index
            encoded = np.where(probabilities[:, positive_index] >= self.threshold_, positive_index, negative_index)
        else:
            encoded = np.argmax(probabilities, axis=1)
        return self.label_encoder_.inverse_transform(encoded)

    def _positive_index(self):
        normalized = [str(label).strip().lower() for label in self.classes_]
        positive_labels = {"1", "yes", "true", "required", "oxygen required", "postoperative oxygen required"}
        for index, label in enumerate(normalized):
            if label in positive_labels:
                return index
        return len(self.classes_) - 1


class CalibratedPredictionPipeline:
    """Persist a raw estimator beside its sigmoid-calibrated prediction wrapper."""

    def __init__(self, raw_pipeline, calibrated_pipeline, calibration_metadata=None):
        self.raw_pipeline = raw_pipeline
        self.calibrated_pipeline = calibrated_pipeline
        self.calibration_metadata = calibration_metadata or {}
        self.classes_ = getattr(calibrated_pipeline, "classes_", getattr(raw_pipeline, "classes_", np.array([0, 1])))

    def predict_proba(self, X):
        return self.calibrated_pipeline.predict_proba(X)

    def raw_predict_proba(self, X):
        return self.raw_pipeline.predict_proba(X)

    def predict(self, X):
        return self.calibrated_pipeline.predict(X)


def train_model(dataset_path: str, target_column: str = None, model_type: str = "random_forest", output_path: str = None) -> dict:
    """Train a model from the requested algorithm on a tabular dataset.

    model_type: one of ['logistic_regression','random_forest','xgboost','lightgbm',
                         'knn','svm','mlp','tab_transformer','naive_bayes']

    Returns dict: {model_path, metrics, metadata}
    """
    set_global_random_seed(TRAINING_RANDOM_SEED)
    df = read_dataset(dataset_path)
    df, target_column, dataset_cleaning = clean_training_dataset(df, target_column=target_column)

    y_raw = df[target_column]
    X = df.drop(columns=[target_column])
    dropped_columns = columns_to_drop_before_training(X)
    if dropped_columns:
        X = X.drop(columns=dropped_columns)

    if MAX_LOCAL_TRAINING_ROWS > 0 and len(X) > MAX_LOCAL_TRAINING_ROWS:
        sample_state = 42
        y_series = pd.Series(y_raw)
        try:
            sampled_index = (
                X.assign(__target=y_series)
                .groupby("__target", group_keys=False)
                .sample(frac=MAX_LOCAL_TRAINING_ROWS / len(X), random_state=sample_state)
                .index
            )
            if len(sampled_index) < min(MAX_LOCAL_TRAINING_ROWS, len(X) // 2):
                sampled_index = X.sample(n=MAX_LOCAL_TRAINING_ROWS, random_state=sample_state).index
        except Exception:
            sampled_index = X.sample(n=MAX_LOCAL_TRAINING_ROWS, random_state=sample_state).index
        X = X.loc[sampled_index].copy()
        y_raw = y_series.loc[sampled_index].copy()

    algo = model_type.lower()
    is_tab_transformer = algo in {"tab_transformer", "tabtransformer"}
    if is_tab_transformer and TAB_TRANSFORMER_MAX_ROWS > 0 and len(X) > TAB_TRANSFORMER_MAX_ROWS:
        sample_state = 42
        y_series = pd.Series(y_raw)
        try:
            sampled_index = (
                X.assign(__target=y_series)
                .groupby("__target", group_keys=False)
                .sample(frac=TAB_TRANSFORMER_MAX_ROWS / len(X), random_state=sample_state)
                .index
            )
            if len(sampled_index) < min(TAB_TRANSFORMER_MAX_ROWS, len(X) // 2):
                sampled_index = X.sample(n=TAB_TRANSFORMER_MAX_ROWS, random_state=sample_state).index
        except Exception:
            sampled_index = X.sample(n=TAB_TRANSFORMER_MAX_ROWS, random_state=sample_state).index
        X = X.loc[sampled_index].copy()
        y_raw = y_series.loc[sampled_index].copy()

    y, class_labels, positive_label, negative_label = encode_binary_target(y_raw)

    boolean_columns = X.select_dtypes(include=["bool"]).columns.tolist()
    numeric_columns = X.select_dtypes(include=["number"]).columns.tolist() + boolean_columns
    numeric_columns = list(dict.fromkeys(numeric_columns))
    categorical_columns = [column for column in X.columns if column not in numeric_columns]
    high_cardinality_columns = high_cardinality_categorical_columns(X, categorical_columns)
    if high_cardinality_columns:
        X = X.drop(columns=high_cardinality_columns)
        dropped_columns += high_cardinality_columns
        categorical_columns = [column for column in categorical_columns if column not in high_cardinality_columns]

    use_ordinal_categorical = is_tab_transformer or algo in {"knn", "knearest", "k-nearest"}
    categorical_encoder = categorical_ordinal_encoder() if use_ordinal_categorical else dense_one_hot_encoder()
    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", SimpleImputer(strategy="median"), numeric_columns),
            (
                "categorical",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", categorical_encoder),
                    ]
                ),
                categorical_columns,
            ),
        ],
        remainder="drop",
        sparse_threshold=0.0,
    )

    test_size = 0.3
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=TRAINING_RANDOM_SEED,
        stratify=y,
    )

    class_weight_info = training_class_weight_info(y_train)
    categorical_feature_indices = None
    if algo in {"knn", "knearest", "k-nearest"} and categorical_columns:
        categorical_feature_indices = list(range(len(numeric_columns), len(numeric_columns) + len(categorical_columns)))

    candidates = model_candidates(
        algo=algo,
        class_weight_info=class_weight_info,
        categorical_feature_indices=categorical_feature_indices,
        training_row_count=len(X_train),
    )
    if not candidates:
        raise ValueError(f'Unknown model type: {model_type}')

    best_selection = select_model_and_threshold(
        candidates=candidates,
        preprocessor=preprocessor,
        X_train=X_train,
        y_train=y_train,
        algo=algo,
        is_tab_transformer=is_tab_transformer,
    )
    model = best_selection["model"]

    raw_pipeline = build_pipeline(preprocessor, model, is_tab_transformer)
    fit_pipeline(raw_pipeline, X_train, y_train, algo)
    calibrated_pipeline, calibration_fit_metadata = fit_sigmoid_calibrated_pipeline(
        preprocessor=preprocessor,
        model=model,
        X_train=X_train,
        y_train=y_train,
        algo=algo,
        is_tab_transformer=is_tab_transformer,
    )
    pipeline = CalibratedPredictionPipeline(
        raw_pipeline=raw_pipeline,
        calibrated_pipeline=calibrated_pipeline,
        calibration_metadata=calibration_fit_metadata,
    )

    labels = [0, 1]
    raw_test_probabilities = positive_probabilities(raw_pipeline, X_test)
    test_probabilities = positive_probabilities(pipeline, X_test)
    selected_threshold = best_selection["threshold"]
    test_preds = (test_probabilities >= selected_threshold).astype(int)
    metrics = build_binary_metrics(
        y_true=y_test,
        probabilities=test_probabilities,
        preds=test_preds,
        labels=labels,
        class_labels=class_labels,
        prefix="test",
    )
    metrics.update(legacy_metric_aliases(metrics))
    metrics["cross_validation"] = best_selection["cv_summary"]
    metrics["selected_threshold"] = selected_threshold
    metrics["threshold_selection"] = best_selection["threshold_selection"]
    metrics["class_distribution"] = class_distribution_report(y, y_train, y_test)
    metrics["class_weights"] = class_weight_info
    metrics["weighting_method"] = weighting_method_description(algo, class_weight_info)
    metrics["raw_test_brier_score"] = safe_metric(lambda: brier_score_loss(y_test, raw_test_probabilities))
    metrics["calibration"] = calibration_report(y_test, test_probabilities, calibration_fit_metadata)
    metrics["subgroup_report"] = subgroup_report(X_test, y_test, test_preds, class_labels)
    metrics["final_test_metrics"] = {
        key: value for key, value in metrics.items()
        if key.startswith("test_") or key in {"confusion_matrix", "confusion_matrix_labels"}
    }
    if is_tab_transformer:
        metrics["top_predictors"] = equal_predictor_contributions_table(X_test.columns)
    else:
        metrics["top_predictors"] = top_predictor_contributions(
            raw_pipeline,
            numeric_columns,
            categorical_columns,
            X_val=X_test,
            y_val=y_test,
        )
    metrics["dataset_cleaning"] = dataset_cleaning

    os.makedirs(os.path.join(os.path.dirname(__file__), "models"), exist_ok=True)
    ts = int(time.time())
    model_filename = f"{algo}_model_{ts}.joblib"
    model_path = output_path or os.path.join(os.path.dirname(__file__), "models", model_filename)
    joblib.dump(pipeline, model_path)

    # Save metadata (columns used) for later alignment at prediction time
    metadata = {
        "columns": list(X.columns),
        "target": target_column,
        "algorithm": algo,
        "dropped_columns": dropped_columns,
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "class_labels": class_labels,
        "positive_class": positive_label,
        "negative_class": negative_label,
        "row_count": int(len(df)),
        "training_row_count": int(len(X_train)),
        "test_row_count": int(len(X_test)),
        "validation_row_count": int(len(X_test)),
        "validation_size": test_size,
        "test_size": test_size,
        "feature_count": int(len(X.columns)),
        "numeric_feature_count": int(len(numeric_columns)),
        "categorical_feature_count": int(len(categorical_columns)),
        "high_cardinality_limit": MAX_CATEGORICAL_UNIQUE_VALUES,
        "row_limit": MAX_LOCAL_TRAINING_ROWS or None,
        "tab_transformer_row_limit": TAB_TRANSFORMER_MAX_ROWS or None,
        "training_runtime_profile": runtime_profile(algo, len(X_train)),
        "model_parameters": json_safe(model.get_params()),
        "class_weights": class_weight_info,
        "weighting_method": metrics["weighting_method"],
        "selected_threshold": selected_threshold,
        "threshold_selection": metrics["threshold_selection"],
        "calibration_method": calibration_fit_metadata["method"],
        "calibration_fit": calibration_fit_metadata,
        "random_seed": TRAINING_RANDOM_SEED,
        "training_date": pd.Timestamp.now(tz="UTC").isoformat(),
        "model_version": model_filename,
        "class_distribution": metrics["class_distribution"],
        "cross_validation": metrics["cross_validation"],
        "final_test_metrics": metrics["final_test_metrics"],
        "calibration": metrics["calibration"],
        "subgroup_report": metrics["subgroup_report"],
        "top_predictors": metrics["top_predictors"],
        "dataset_cleaning": dataset_cleaning,
        "performance_metrics": metrics,
    }
    meta_path = model_path + ".meta.json"
    with open(meta_path, 'w') as mf:
        json.dump(metadata, mf)

    return {"model_path": model_path, "metrics": metrics, "metadata": metadata}


def set_global_random_seed(seed):
    random.seed(int(seed))
    np.random.seed(int(seed))
    if torch is not None:
        torch.manual_seed(int(seed))
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(int(seed))


def encode_binary_target(y):
    series = pd.Series(y).dropna()
    labels = sorted(series.astype(str).unique().tolist(), key=lambda item: positive_label_sort_key(item))
    if len(labels) != 2:
        raise ValueError("Cost-sensitive postoperative oxygen training requires a binary outcome column.")
    positive_label = labels[-1]
    negative_label = labels[0]
    encoded = pd.Series(y).astype(str).map({negative_label: 0, positive_label: 1})
    if encoded.isna().any():
        raise ValueError("Target column contains values outside the resolved binary classes.")
    return encoded.astype(int), [negative_label, positive_label], positive_label, negative_label


def positive_label_sort_key(label):
    normalized = str(label).strip().lower()
    positive_labels = {"1", "yes", "true", "required", "oxygen required", "postoperative oxygen required"}
    return (normalized in positive_labels, normalized)


def training_class_weight_info(y_train):
    y_array = np.asarray(y_train, dtype=int)
    negative_cases = int((y_array == 0).sum())
    positive_cases = int((y_array == 1).sum())
    if positive_cases <= 0 or negative_cases <= 0:
        raise ValueError("Training split must contain both positive and negative outcome classes.")
    positive_class_weight = negative_cases / positive_cases
    return {
        "negative_cases": negative_cases,
        "positive_cases": positive_cases,
        "positive_class_weight": safe_float(positive_class_weight),
        "computed_from": "training_split_only",
        "formula": "number_of_negative_training_cases / number_of_positive_training_cases",
    }


def class_weight_dict(class_weight_info):
    return {0: 1.0, 1: float(class_weight_info["positive_class_weight"])}


def model_candidates(algo, class_weight_info, categorical_feature_indices=None, training_row_count=0):
    weight = float(class_weight_info["positive_class_weight"])
    class_weights = class_weight_dict(class_weight_info)
    large = int(training_row_count or 0) >= LARGE_DATASET_ROW_COUNT
    if algo == 'random_forest':
        candidates = [
            RandomForestClassifier(n_estimators=80, max_depth=8, min_samples_leaf=2, n_jobs=1, random_state=TRAINING_RANDOM_SEED, class_weight="balanced"),
            RandomForestClassifier(n_estimators=120, max_depth=None, min_samples_leaf=2, n_jobs=1, random_state=TRAINING_RANDOM_SEED, class_weight="balanced"),
        ]
        return candidates[:1] if large else candidates
    if algo in {'logistic_regression', 'logistic'}:
        candidates = [
            LogisticRegression(max_iter=2000, class_weight="balanced", solver="lbfgs"),
            LogisticRegression(max_iter=2000, class_weight=class_weights, solver="lbfgs", C=0.5),
        ]
        return candidates[:1] if large else candidates
    if algo in {'knn', 'knearest', 'k-nearest'}:
        candidates = [
            ResampledKNNClassifier(n_neighbors=5, categorical_feature_indices=categorical_feature_indices, random_state=TRAINING_RANDOM_SEED),
            ResampledKNNClassifier(n_neighbors=9, categorical_feature_indices=categorical_feature_indices, random_state=TRAINING_RANDOM_SEED),
        ]
        return candidates[:1] if large else candidates
    if algo in {'svm', 'svc'}:
        if large:
            return [
                SGDClassifier(
                    loss="log_loss",
                    penalty="l2",
                    alpha=0.0001,
                    max_iter=1500,
                    tol=1e-3,
                    class_weight="balanced",
                    random_state=TRAINING_RANDOM_SEED,
                )
            ]
        return [SVC(probability=True, class_weight="balanced", C=1.0, random_state=TRAINING_RANDOM_SEED)]
    if algo in {'mlp', 'mlp_classifier', 'neural_network'}:
        candidates = [
            WeightedTorchMLPClassifier(hidden_units=64, max_epochs=20, random_state=TRAINING_RANDOM_SEED),
            WeightedTorchMLPClassifier(hidden_units=96, max_epochs=25, random_state=TRAINING_RANDOM_SEED),
        ]
        return candidates[:1] if large else candidates
    if algo in {'tab_transformer', 'tabtransformer'}:
        return [
            TabTransformerClassifier(max_epochs=3 if large else 4, class_weight=class_weights, random_state=TRAINING_RANDOM_SEED),
        ]
    if algo in {'naive_bayes', 'nb'}:
        return [GaussianNB()]
    if algo == 'xgboost':
        if xgb is None:
            raise RuntimeError('xgboost is not installed')
        candidates = [
            xgb.XGBClassifier(eval_metric='logloss', n_estimators=60, max_depth=3, learning_rate=0.08, subsample=0.9, colsample_bytree=0.9, n_jobs=1, random_state=TRAINING_RANDOM_SEED, scale_pos_weight=weight),
            xgb.XGBClassifier(eval_metric='logloss', n_estimators=80, max_depth=2, learning_rate=0.06, subsample=0.9, colsample_bytree=0.9, n_jobs=1, random_state=TRAINING_RANDOM_SEED, scale_pos_weight=weight),
        ]
        return candidates[:1] if large else candidates
    if algo in {'lightgbm', 'lgbm'}:
        if lgb is None:
            raise RuntimeError('lightgbm is not installed')
        candidates = [
            lgb.LGBMClassifier(n_estimators=80, learning_rate=0.06, random_state=TRAINING_RANDOM_SEED, n_jobs=1, scale_pos_weight=weight, verbose=-1),
            lgb.LGBMClassifier(n_estimators=120, learning_rate=0.04, num_leaves=20, random_state=TRAINING_RANDOM_SEED, n_jobs=1, scale_pos_weight=weight, verbose=-1),
        ]
        return candidates[:1] if large else candidates
    return []


def build_pipeline(preprocessor, model, is_tab_transformer):
    pipeline_steps = [("preprocessor", preprocessor)]
    if is_tab_transformer:
        pipeline_steps.append(("scaler", StandardScaler()))
    pipeline_steps.append(("model", model))
    return Pipeline(steps=pipeline_steps)


def fit_pipeline(pipeline, X_train, y_train, algo):
    fit_kwargs = {}
    if algo in {"naive_bayes", "nb"}:
        fit_kwargs["model__sample_weight"] = sample_weights_from_training_labels(y_train)
    pipeline.fit(X_train, y_train, **fit_kwargs)
    return pipeline


def fit_sigmoid_calibrated_pipeline(preprocessor, model, X_train, y_train, algo, is_tab_transformer):
    cv = calibration_cv_splitter(algo, y_train)
    pipeline = build_pipeline(clone(preprocessor), clone(model), is_tab_transformer)
    calibrator = CalibratedClassifierCV(
        estimator=pipeline,
        method="sigmoid",
        cv=cv,
    )
    calibrator.fit(X_train, y_train)
    return calibrator, calibration_fit_metadata(algo, cv)


def calibration_cv_splitter(algo, y_train):
    min_class_count = int(pd.Series(y_train).value_counts().min())
    max_splits = 3 if len(y_train) >= LARGE_DATASET_ROW_COUNT or is_heavy_algorithm(algo) else 5
    n_splits = max(2, min(max_splits, min_class_count))
    return StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=TRAINING_RANDOM_SEED)


def calibration_fit_metadata(algo, cv):
    return {
        "method": "Sigmoid / Platt scaling",
        "sklearn_estimator": "CalibratedClassifierCV",
        "cv_strategy": "StratifiedKFold",
        "n_splits": int(cv.n_splits),
        "shuffle": bool(cv.shuffle),
        "random_state": TRAINING_RANDOM_SEED,
        "fit_data": "training_split_only",
        "test_set_usage": "never used for calibration, threshold selection, oversampling, or model fitting",
        "algorithm": algo,
    }


def sample_weights_from_training_labels(y_train):
    info = training_class_weight_info(y_train)
    weights = class_weight_dict(info)
    return np.asarray([weights[int(label)] for label in y_train], dtype=float)


def select_model_and_threshold(candidates, preprocessor, X_train, y_train, algo, is_tab_transformer):
    splitter = cv_splitter(algo, y_train)
    selections = []
    for candidate in candidates:
        fold_probabilities = np.zeros(len(y_train), dtype=float)
        fold_metrics = []
        for fold_index, (train_index, valid_index) in enumerate(splitter.split(X_train, y_train), start=1):
            X_fold_train = X_train.iloc[train_index]
            X_fold_valid = X_train.iloc[valid_index]
            y_fold_train = np.asarray(y_train)[train_index]
            y_fold_valid = np.asarray(y_train)[valid_index]
            fold_candidate, fold_weight_info = fold_specific_candidate(candidate, algo, y_fold_train)
            pipeline, calibration_fit = fit_sigmoid_calibrated_pipeline(
                preprocessor=preprocessor,
                model=fold_candidate,
                X_train=X_fold_train,
                y_train=y_fold_train,
                algo=algo,
                is_tab_transformer=is_tab_transformer,
            )
            probabilities = positive_probabilities(pipeline, X_fold_valid)
            fold_probabilities[valid_index] = probabilities
            fold_threshold = choose_threshold(y_fold_valid, probabilities)["threshold"]
            fold_preds = (probabilities >= fold_threshold).astype(int)
            fold_metrics.append({
                "fold": fold_index,
                "sensitivity": sensitivity_score(y_fold_valid, fold_preds),
                "auc": safe_metric(lambda: roc_auc_score(y_fold_valid, probabilities)),
                "f1": safe_float(f1_score(y_fold_valid, fold_preds, zero_division=0)),
                "positive_class_weight": fold_weight_info.get("positive_class_weight"),
                "weight_computed_from": fold_weight_info.get("computed_from"),
                "calibration_method": calibration_fit["method"],
                "calibration_fit_data": calibration_fit["fit_data"],
            })
        threshold_selection = choose_threshold(y_train, fold_probabilities)
        candidate_preds = (fold_probabilities >= threshold_selection["threshold"]).astype(int)
        selections.append({
            "model": candidate,
            "threshold": threshold_selection["threshold"],
            "threshold_selection": threshold_selection,
            "cv_summary": cv_summary(fold_metrics, candidate, threshold_selection, candidate_preds, y_train),
            "score": threshold_selection["f2_score"],
            "sensitivity": sensitivity_score(y_train, candidate_preds),
        })

    return sorted(selections, key=lambda item: (item["score"], item["sensitivity"]), reverse=True)[0]


def fold_specific_candidate(candidate, algo, y_fold_train):
    estimator = clone(candidate)
    fold_weight_info = training_class_weight_info(y_fold_train)
    weight = float(fold_weight_info["positive_class_weight"])
    if algo == "xgboost" and hasattr(estimator, "set_params"):
        estimator.set_params(scale_pos_weight=weight)
        fold_weight_info["applied_as"] = "scale_pos_weight"
    elif algo in {"lightgbm", "lgbm"} and hasattr(estimator, "set_params"):
        estimator.set_params(scale_pos_weight=weight)
        fold_weight_info["applied_as"] = "scale_pos_weight"
    else:
        fold_weight_info["applied_as"] = "estimator fit-time weighting or fold-local resampling"
    fold_weight_info["computed_from"] = "training_cv_fold_only"
    return estimator, fold_weight_info


def cv_splitter(algo, y_train):
    min_class_count = int(pd.Series(y_train).value_counts().min())
    max_splits = 2 if len(y_train) >= LARGE_DATASET_ROW_COUNT or is_heavy_algorithm(algo) else 3
    n_splits = max(2, min(max_splits, min_class_count))
    return StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=TRAINING_RANDOM_SEED)


def is_heavy_algorithm(algo):
    return algo in {"svm", "svc", "knn", "knearest", "k-nearest", "mlp", "mlp_classifier", "neural_network", "tab_transformer", "tabtransformer"}


def runtime_profile(algo, training_row_count):
    large = int(training_row_count or 0) >= LARGE_DATASET_ROW_COUNT
    notes = [
        "final test split remains untouched",
        "sigmoid calibration uses stratified training folds only",
    ]
    if large:
        notes.append("large-dataset profile uses one candidate and reduced CV folds to support 10000-row training")
    if algo in {"svm", "svc"} and large:
        notes.append("SVM uses a scalable linear SGD probability estimator before Platt calibration")
    return {
        "training_row_count": int(training_row_count or 0),
        "large_dataset_threshold": LARGE_DATASET_ROW_COUNT,
        "large_dataset_profile": large,
        "notes": notes,
    }


def positive_probabilities(pipeline, X):
    probabilities = pipeline.predict_proba(X)
    if probabilities.ndim == 1:
        return probabilities
    classes = model_classes(pipeline)
    positive_index = positive_label_index(classes)
    return probabilities[:, positive_index]


def model_classes(model):
    if hasattr(model, "classes_"):
        return list(getattr(model, "classes_"))
    if hasattr(model, "named_steps"):
        return list(getattr(model.named_steps["model"], "classes_", [0, 1]))
    if hasattr(model, "calibrated_pipeline"):
        return model_classes(model.calibrated_pipeline)
    return [0, 1]


def choose_threshold(y_true, probabilities):
    best = None
    best_fallback = None
    for threshold in np.linspace(0.05, 0.9, 35):
        preds = (np.asarray(probabilities) >= threshold).astype(int)
        f2 = safe_float(fbeta_score(y_true, preds, beta=2, zero_division=0)) or 0.0
        sensitivity = sensitivity_score(y_true, preds) or 0.0
        balanced_accuracy = safe_float(balanced_accuracy_score(y_true, preds)) or 0.0
        matrix = confusion_matrix(y_true, preds, labels=[0, 1])
        if matrix.shape == (2, 2):
            tn, fp, fn, tp = (int(matrix[0][0]), int(matrix[0][1]), int(matrix[1][0]), int(matrix[1][1]))
        else:
            tn = fp = fn = tp = 0
        negative_total = tn + fp
        predicted_negative_total = tn + fn
        sample_total = len(preds)
        specificity = safe_float(tn / negative_total) if negative_total else None
        predicted_negative_rate = safe_float(predicted_negative_total / sample_total) if sample_total else 0.0
        degenerate_prediction = bool(negative_total and predicted_negative_total == 0)
        eligible = not degenerate_prediction
        if specificity is not None:
            eligible = eligible and specificity >= MIN_THRESHOLD_SPECIFICITY
        if negative_total:
            eligible = eligible and predicted_negative_rate >= MIN_THRESHOLD_PREDICTED_NEGATIVE_RATE
        candidate = {
            "threshold": float(threshold),
            "f2_score": f2,
            "sensitivity": sensitivity,
            "specificity": specificity,
            "balanced_accuracy": balanced_accuracy,
            "false_negatives": fn,
            "true_negatives": tn,
            "false_positives": fp,
            "true_positives": tp,
            "predicted_negative_rate": predicted_negative_rate,
            "degenerate_prediction": degenerate_prediction,
            "eligible": eligible,
            "rule": (
                "maximize F2-score on stratified CV training folds, requiring non-degenerate predictions "
                f"with specificity >= {MIN_THRESHOLD_SPECIFICITY:g}; tie-break by sensitivity then fewer false negatives"
            ),
        }
        if best_fallback is None or threshold_sort_key(candidate) > threshold_sort_key(best_fallback):
            best_fallback = candidate
        if not eligible:
            continue
        if best is None or threshold_sort_key(candidate) > threshold_sort_key(best):
            best = candidate
    if best is None and best_fallback is not None:
        best_fallback["eligible"] = False
        best_fallback["rule"] += "; no threshold satisfied the non-degenerate guard, so the best fallback was used"
        return best_fallback
    return best


def threshold_sort_key(candidate):
    return (
        candidate["f2_score"],
        candidate["sensitivity"],
        -candidate["false_negatives"],
        candidate["balanced_accuracy"],
        candidate["specificity"] or 0.0,
    )


def cv_summary(fold_metrics, candidate, threshold_selection, preds, y_train):
    return {
        "strategy": "stratified cross-validation on training split only",
        "model_parameters": json_safe(candidate.get_params()),
        "selected_threshold": threshold_selection["threshold"],
        "threshold_rule": threshold_selection["rule"],
        "mean_sensitivity": mean_metric(fold_metrics, "sensitivity"),
        "std_sensitivity": std_metric(fold_metrics, "sensitivity"),
        "mean_auc": mean_metric(fold_metrics, "auc"),
        "std_auc": std_metric(fold_metrics, "auc"),
        "mean_f1": mean_metric(fold_metrics, "f1"),
        "std_f1": std_metric(fold_metrics, "f1"),
        "training_cv_f2": safe_float(fbeta_score(y_train, preds, beta=2, zero_division=0)),
        "folds": json_safe(fold_metrics),
    }


def mean_metric(rows, key):
    values = [float(row[key]) for row in rows if row.get(key) is not None]
    return safe_float(np.mean(values)) if values else None


def std_metric(rows, key):
    values = [float(row[key]) for row in rows if row.get(key) is not None]
    return safe_float(np.std(values, ddof=1)) if len(values) > 1 else 0.0 if values else None


def build_binary_metrics(y_true, probabilities, preds, labels, class_labels, prefix="test"):
    matrix = confusion_matrix(y_true, preds, labels=labels)
    tn, fp, fn, tp = binary_counts(matrix)
    metrics = {
        f"{prefix}_accuracy": safe_float(accuracy_score(y_true, preds)),
        f"{prefix}_balanced_accuracy": safe_float(balanced_accuracy_score(y_true, preds)),
        f"{prefix}_sensitivity": sensitivity_score(y_true, preds),
        f"{prefix}_specificity": safe_float(tn / (tn + fp)) if (tn + fp) else None,
        f"{prefix}_precision": safe_float(precision_score(y_true, preds, zero_division=0)),
        f"{prefix}_f1_score": safe_float(f1_score(y_true, preds, zero_division=0)),
        f"{prefix}_f2_score": safe_float(fbeta_score(y_true, preds, beta=2, zero_division=0)),
        f"{prefix}_auc": safe_metric(lambda: roc_auc_score(y_true, probabilities)),
        f"{prefix}_false_negative_rate": safe_float(fn / (fn + tp)) if (fn + tp) else None,
        f"{prefix}_brier_score": safe_metric(lambda: brier_score_loss(y_true, probabilities)),
        "confusion_matrix": matrix.tolist(),
        "confusion_matrix_labels": [str(label) for label in class_labels],
        "classification_report": json_safe(classification_report(y_true, preds, labels=labels, target_names=[str(label) for label in class_labels], output_dict=True, zero_division=0)),
    }
    return enrich_metric_benchmarks(metrics)


def legacy_metric_aliases(metrics):
    return {
        "val_accuracy": metrics.get("test_accuracy"),
        "val_balanced_accuracy": metrics.get("test_balanced_accuracy"),
        "val_precision_weighted": metrics.get("test_precision"),
        "val_precision_macro": metrics.get("test_precision"),
        "val_recall_weighted": metrics.get("test_sensitivity"),
        "val_recall_macro": metrics.get("test_sensitivity"),
        "val_sensitivity": metrics.get("test_sensitivity"),
        "sensitivity": metrics.get("test_sensitivity"),
        "val_specificity": metrics.get("test_specificity"),
        "specificity": metrics.get("test_specificity"),
        "val_f1_score": metrics.get("test_f1_score"),
        "val_f1_macro": metrics.get("test_f1_score"),
        "f1_score": metrics.get("test_f1_score"),
        "val_roc_auc": metrics.get("test_auc"),
        "val_brier_score": metrics.get("test_brier_score"),
    }


def binary_counts(matrix):
    if matrix.shape != (2, 2):
        return 0, 0, 0, 0
    return float(matrix[0][0]), float(matrix[0][1]), float(matrix[1][0]), float(matrix[1][1])


def sensitivity_score(y_true, y_pred):
    return safe_float(recall_score(y_true, y_pred, pos_label=1, zero_division=0))


def class_distribution_report(y_all, y_train, y_test):
    return {
        "overall": binary_distribution(y_all),
        "training": binary_distribution(y_train),
        "test": binary_distribution(y_test),
        "split": "stratified 70:30 train:test",
        "test_set_policy": "final test set is untouched; no class weighting, resampling, SMOTE, or threshold tuning is applied to it",
    }


def binary_distribution(values):
    y_array = np.asarray(values, dtype=int)
    negative = int((y_array == 0).sum())
    positive = int((y_array == 1).sum())
    total = negative + positive
    return {
        "negative": negative,
        "positive": positive,
        "total": total,
        "positive_rate": safe_float(positive / total) if total else None,
    }


def calibration_report(y_true, probabilities, calibration_fit=None):
    fraction_positive, mean_predicted = calibration_curve(y_true, probabilities, n_bins=min(10, len(np.unique(probabilities))), strategy="uniform")
    brier = safe_metric(lambda: brier_score_loss(y_true, probabilities))
    calibration_fit = calibration_fit or {}
    return {
        "method": calibration_fit.get("method") or "Sigmoid / Platt scaling",
        "curve_method": "uniform-bin reliability curve on untouched final test set",
        "brier_score": brier,
        "mean_predicted_probability": [safe_float(item) for item in mean_predicted],
        "fraction_of_positives": [safe_float(item) for item in fraction_positive],
        "fit_data": calibration_fit.get("fit_data") or "training_split_only",
        "test_set_usage": calibration_fit.get("test_set_usage") or "never used for calibration, threshold selection, oversampling, or model fitting",
        "cv_strategy": calibration_fit.get("cv_strategy"),
        "n_splits": calibration_fit.get("n_splits"),
        "summary": "Lower Brier score indicates better probability calibration.",
    }


def subgroup_report(X_test, y_test, preds, class_labels):
    rows = []
    for column in ["copd_or_asthma", "copd_asthma", "sleep_apnea"]:
        if column not in X_test.columns:
            continue
        present = X_test[column].astype(str).str.strip().str.lower().isin({"yes", "true", "1", "positive", "present"})
        if not present.any():
            rows.append(empty_subgroup_row(column))
            continue
        y_sub = np.asarray(y_test)[present.to_numpy()]
        pred_sub = np.asarray(preds)[present.to_numpy()]
        matrix = confusion_matrix(y_sub, pred_sub, labels=[0, 1])
        _tn, _fp, fn, tp = binary_counts(matrix)
        sensitivity = sensitivity_score(y_sub, pred_sub)
        positive_count = int((y_sub == 1).sum())
        rows.append({
            "predictor": column,
            "present_value": "Yes/true/present",
            "sample_size": int(present.sum()),
            "observed_oxygen_requirement_rate": safe_float(positive_count / len(y_sub)) if len(y_sub) else None,
            "sensitivity": sensitivity,
            "false_negatives": int(fn),
            "confidence_interval": proportion_confidence_interval(int(tp), int(tp + fn)) if (tp + fn) else None,
            "class_labels": [str(label) for label in class_labels],
            "weighting_note": "Predictor retained as a normal feature; no extra predictor-specific weight applied.",
        })
    return rows


def empty_subgroup_row(column):
    return {
        "predictor": column,
        "sample_size": 0,
        "observed_oxygen_requirement_rate": None,
        "sensitivity": None,
        "false_negatives": 0,
        "confidence_interval": None,
        "weighting_note": "Predictor retained when present; no extra predictor-specific weight applied.",
    }


def proportion_confidence_interval(successes, total, z=1.96):
    if total <= 0:
        return None
    p = successes / total
    denominator = 1 + z**2 / total
    center = (p + z**2 / (2 * total)) / denominator
    margin = (z * math.sqrt((p * (1 - p) / total) + (z**2 / (4 * total**2)))) / denominator
    return {"method": "Wilson", "lower": safe_float(max(0, center - margin)), "upper": safe_float(min(1, center + margin))}


def weighting_method_description(algo, class_weight_info):
    weight = class_weight_info["positive_class_weight"]
    if algo in {"logistic_regression", "logistic", "random_forest", "svm", "svc"}:
        return f"class_weight balanced/equivalent computed from training data only; positive_class_weight={weight:.4f}"
    if algo in {"xgboost", "lightgbm", "lgbm"}:
        return f"scale_pos_weight={weight:.4f}, computed from training data only"
    if algo in {"mlp", "mlp_classifier", "neural_network", "tab_transformer", "tabtransformer"}:
        return f"weighted binary/cross-entropy loss with positive_class_weight={weight:.4f}, computed from training data only"
    if algo in {"knn", "knearest", "k-nearest"}:
        return "fold-local KNN minority resampling on training folds only; final test set remains untouched"
    if algo in {"naive_bayes", "nb"}:
        return f"GaussianNB sample_weight applied during fit with positive_class_weight={weight:.4f}, computed from training data only"
    return "No weighting method recorded"


def random_oversample_minority(X, y, random_state=42):
    rng = np.random.default_rng(int(random_state))
    y_array = np.asarray(y)
    classes, counts = np.unique(y_array, return_counts=True)
    if len(classes) < 2 or counts.min() == counts.max():
        return X, y_array
    majority_class = classes[np.argmax(counts)]
    minority_class = classes[np.argmin(counts)]
    majority_count = int(counts.max())
    minority_indices = np.where(y_array == minority_class)[0]
    additional = majority_count - len(minority_indices)
    sampled = rng.choice(minority_indices, size=additional, replace=True)
    indices = np.concatenate([np.arange(len(y_array)), sampled])
    rng.shuffle(indices)
    return np.asarray(X)[indices], y_array[indices]


def columns_to_drop_before_training(X: pd.DataFrame) -> list:
    """Remove identifiers, dates, leakage outputs, and free-text columns that make training slow/noisy."""
    drop_names = {
        "id",
        "hospital_id",
        "patient_id",
        "patient_coded_id",
        "date_of_admission",
        "date_of_surgery",
        "date_of_discharge_or_death",
        "admission_date",
        "surgery_date",
        "discharge_date",
        "death_date",
        "oxygen_need_probability",
        "oxygen_duration_hours",
        "risk_classification",
        "brief_recommendation",
        "recommendation",
        "other_relevant_preoperative_labs",
        "data_sources_reviewed",
        "reason_for_exclusion",
    }
    dropped = []
    for column in X.columns:
        normalized = str(column).strip().lower()
        if normalized in drop_names or normalized.endswith("_id") or normalized.startswith("date_"):
            dropped.append(column)
            continue
        if "date" in normalized and pd.api.types.is_object_dtype(X[column]):
            dropped.append(column)
            continue
        if pd.api.types.is_object_dtype(X[column]) or pd.api.types.is_string_dtype(X[column]):
            average_length = X[column].dropna().astype(str).str.len().mean()
            if average_length and average_length > 40:
                dropped.append(column)
    return dropped


def high_cardinality_categorical_columns(X: pd.DataFrame, categorical_columns: list) -> list:
    dropped = []
    for column in categorical_columns:
        unique_count = int(X[column].nunique(dropna=True))
        if unique_count > MAX_CATEGORICAL_UNIQUE_VALUES:
            dropped.append(column)
    return dropped


def build_training_metrics(pipeline, X_val, y_val, preds, labels) -> dict:
    matrix = confusion_matrix(y_val, preds, labels=labels)
    sensitivity = calculate_sensitivity(y_val, preds, labels)
    specificity = calculate_specificity(matrix, labels)
    weighted_recall = safe_float(recall_score(y_val, preds, average="weighted", zero_division=0))
    metrics = {
        "val_accuracy": safe_float(accuracy_score(y_val, preds)),
        "val_balanced_accuracy": safe_float(balanced_accuracy_score(y_val, preds)),
        "val_precision_weighted": safe_float(precision_score(y_val, preds, average="weighted", zero_division=0)),
        "val_precision_macro": safe_float(precision_score(y_val, preds, average="macro", zero_division=0)),
        "val_recall_weighted": weighted_recall,
        "val_recall_macro": safe_float(recall_score(y_val, preds, average="macro", zero_division=0)),
        "val_sensitivity": sensitivity,
        "sensitivity": sensitivity,
        "val_specificity": specificity,
        "specificity": specificity,
        "val_f1_score": safe_float(f1_score(y_val, preds, average="weighted", zero_division=0)),
        "val_f1_macro": safe_float(f1_score(y_val, preds, average="macro", zero_division=0)),
        "f1_score": safe_float(f1_score(y_val, preds, average="weighted", zero_division=0)),
        "confusion_matrix": matrix.tolist(),
        "confusion_matrix_labels": [str(label) for label in labels],
        "classification_report": json_safe(classification_report(y_val, preds, labels=labels, output_dict=True, zero_division=0)),
    }

    probabilities = None
    try:
        probabilities = pipeline.predict_proba(X_val)
    except Exception:
        probabilities = None

    if probabilities is not None:
        metrics["val_log_loss"] = safe_metric(lambda: log_loss(y_val, probabilities, labels=labels))
        if len(labels) == 2 and probabilities.shape[1] >= 2:
            positive_index = positive_label_index(labels)
            metrics["val_roc_auc"] = safe_metric(lambda: roc_auc_score(y_val, probabilities[:, positive_index]))
        elif len(labels) > 2:
            metrics["val_roc_auc_weighted_ovr"] = safe_metric(
                lambda: roc_auc_score(y_val, probabilities, labels=labels, multi_class="ovr", average="weighted")
            )

    return enrich_metric_benchmarks(metrics)


def top_predictor_contributions(pipeline, numeric_columns, categorical_columns, X_val=None, y_val=None, limit=10) -> list:
    """Return normalized model importance aggregated to original dataset columns."""
    try:
        model = pipeline.named_steps["model"]
        importances = raw_model_importances(model)
        grouped = built_in_predictor_contributions(importances, pipeline, numeric_columns, categorical_columns)
        if not grouped:
            grouped = permutation_predictor_contributions(pipeline, X_val, y_val)

        total = sum(grouped.values())
        if total <= 0:
            grouped = equal_predictor_contributions(X_val.columns if X_val is not None else [])
            total = sum(grouped.values())
        if total <= 0:
            return []

        predictors = [
            {
                "rank": rank,
                "predictor": predictor,
                "importance": safe_float(score),
                "contribution_probability": safe_float(score / total),
                "contribution_percent": safe_float((score / total) * 100),
            }
            for rank, (predictor, score) in enumerate(
                sorted(grouped.items(), key=lambda item: item[1], reverse=True)[:limit],
                start=1,
            )
        ]
        return json_safe(predictors)
    except Exception:
        return []


def built_in_predictor_contributions(importances, pipeline, numeric_columns, categorical_columns):
    if importances is None:
        return {}

    preprocessor = pipeline.named_steps["preprocessor"]
    transformed_names = [str(name) for name in preprocessor.get_feature_names_out()]
    if len(transformed_names) != len(importances):
        return {}

    grouped = {}
    for transformed_name, importance in zip(transformed_names, importances):
        original_column = original_column_from_transformed_name(
            transformed_name,
            numeric_columns=numeric_columns,
            categorical_columns=categorical_columns,
        )
        if not original_column:
            continue
        grouped[original_column] = grouped.get(original_column, 0.0) + abs(float(importance))
    return grouped


def permutation_predictor_contributions(pipeline, X_val, y_val):
    if X_val is None or y_val is None or len(X_val) == 0:
        return {}
    if PERMUTATION_IMPORTANCE_MAX_ROWS > 0 and len(X_val) > PERMUTATION_IMPORTANCE_MAX_ROWS:
        rng = np.random.default_rng(TRAINING_RANDOM_SEED)
        sample_positions = rng.choice(len(X_val), size=PERMUTATION_IMPORTANCE_MAX_ROWS, replace=False)
        X_val = X_val.iloc[sample_positions]
        y_val = np.asarray(y_val)[sample_positions]
    result = permutation_importance(
        pipeline,
        X_val,
        y_val,
        n_repeats=3,
        random_state=42,
        n_jobs=1,
    )
    return {
        str(column): max(0.0, float(importance))
        for column, importance in zip(X_val.columns, result.importances_mean)
        if importance > 0
    }


def equal_predictor_contributions(columns):
    return {str(column): 1.0 for column in list(columns)[:10] if str(column)}


def equal_predictor_contributions_table(columns):
    values = list(equal_predictor_contributions(columns).keys())
    if not values:
        return []
    contribution = 1 / len(values)
    return [
        {
            "rank": index,
            "predictor": predictor,
            "importance": contribution,
            "contribution_probability": contribution,
            "contribution_percent": contribution * 100,
        }
        for index, predictor in enumerate(values, start=1)
    ]


def raw_model_importances(model):
    if hasattr(model, "feature_importances_"):
        return np.asarray(model.feature_importances_, dtype=float)
    if hasattr(model, "coef_"):
        coefficients = np.asarray(model.coef_, dtype=float)
        if coefficients.ndim == 1:
            return np.abs(coefficients)
        return np.mean(np.abs(coefficients), axis=0)
    return None


def original_column_from_transformed_name(transformed_name, numeric_columns, categorical_columns):
    if "__" in transformed_name:
        _, feature_name = transformed_name.split("__", 1)
    else:
        feature_name = transformed_name

    numeric_lookup = {str(column): str(column) for column in numeric_columns}
    if feature_name in numeric_lookup:
        return numeric_lookup[feature_name]

    for column in sorted([str(item) for item in categorical_columns], key=len, reverse=True):
        if feature_name == column or feature_name.startswith(f"{column}_"):
            return column
    return feature_name


def calculate_sensitivity(y_true, y_pred, labels):
    if len(labels) == 2:
        positive_label = labels[positive_label_index(labels)]
        return safe_float(recall_score(y_true, y_pred, labels=[positive_label], average="macro", zero_division=0))
    return safe_float(recall_score(y_true, y_pred, average="weighted", zero_division=0))


def calculate_specificity(matrix, labels=None):
    try:
        if matrix.shape == (2, 2):
            positive_index = positive_label_index(labels or [0, 1])
            negative_index = 1 - positive_index
            true_negative = float(matrix[negative_index][negative_index])
            false_positive = float(matrix[negative_index][positive_index])
            denominator = true_negative + false_positive
            return safe_float(true_negative / denominator) if denominator else None

        values = []
        total = float(matrix.sum())
        for index in range(matrix.shape[0]):
            true_negative = total - matrix[index, :].sum() - matrix[:, index].sum() + matrix[index, index]
            false_positive = matrix[:, index].sum() - matrix[index, index]
            denominator = true_negative + false_positive
            if denominator:
                values.append(true_negative / denominator)
        return safe_float(sum(values) / len(values)) if values else None
    except Exception:
        return None


def positive_label_index(labels):
    normalized = [str(label).strip().lower() for label in labels]
    positive_labels = {"1", "yes", "true", "required", "oxygen required", "postoperative oxygen required"}
    for index, label in enumerate(normalized):
        if label in positive_labels:
            return index
    return len(labels) - 1


def safe_metric(callback):
    try:
        return safe_float(callback())
    except Exception:
        return None


def safe_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def json_safe(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if hasattr(value, "item"):
        return value.item()
    return value
