import os
import re
import time
import joblib
import json
import math
import pandas as pd
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
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

from metric_benchmarks import enrich_metric_benchmarks

# Import common sklearn estimators
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
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

MAX_CATEGORICAL_UNIQUE_VALUES = int(os.getenv("TRAINING_MAX_CATEGORICAL_UNIQUE_VALUES", "80"))
# Set TRAINING_MAX_ROWS to a positive number only when local training needs an
# explicit cap. By default, every cleaned dataset row is available for training.
MAX_LOCAL_TRAINING_ROWS = int(os.getenv("TRAINING_MAX_ROWS", "0"))
TAB_TRANSFORMER_MAX_ROWS = int(os.getenv("TRAINING_TAB_TRANSFORMER_MAX_ROWS", "5000"))


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


class TabTransformerClassifier(BaseEstimator, ClassifierMixin):
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
    ):
        self.max_epochs = max_epochs
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.d_model = d_model
        self.n_heads = n_heads
        self.n_layers = n_layers
        self.dropout = dropout
        self.random_state = random_state

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
        class_weights = np.sqrt(class_counts.sum() / np.maximum(class_counts, 1.0))
        class_weights = class_weights / class_weights.mean()
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


def train_model(dataset_path: str, target_column: str = None, model_type: str = "random_forest", output_path: str = None) -> dict:
    """Train a model from the requested algorithm on a tabular dataset.

    model_type: one of ['logistic_regression','random_forest','xgboost','lightgbm',
                         'knn','svm','mlp','tab_transformer','naive_bayes']

    Returns dict: {model_path, metrics, metadata}
    """
    df = read_dataset(dataset_path)
    df, target_column, dataset_cleaning = clean_training_dataset(df, target_column=target_column)

    y = df[target_column]
    X = df.drop(columns=[target_column])
    dropped_columns = columns_to_drop_before_training(X)
    if dropped_columns:
        X = X.drop(columns=dropped_columns)

    if MAX_LOCAL_TRAINING_ROWS > 0 and len(X) > MAX_LOCAL_TRAINING_ROWS:
        sample_state = 42
        y_series = pd.Series(y)
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
        y = y_series.loc[sampled_index].copy()

    algo = model_type.lower()
    is_tab_transformer = algo in {"tab_transformer", "tabtransformer"}
    if is_tab_transformer and TAB_TRANSFORMER_MAX_ROWS > 0 and len(X) > TAB_TRANSFORMER_MAX_ROWS:
        sample_state = 42
        y_series = pd.Series(y)
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
        y = y_series.loc[sampled_index].copy()

    label_encoder = None
    class_labels = None
    if algo == "xgboost":
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(y.astype(str))
        class_labels = label_encoder.classes_.tolist()

    boolean_columns = X.select_dtypes(include=["bool"]).columns.tolist()
    numeric_columns = X.select_dtypes(include=["number"]).columns.tolist() + boolean_columns
    numeric_columns = list(dict.fromkeys(numeric_columns))
    categorical_columns = [column for column in X.columns if column not in numeric_columns]
    high_cardinality_columns = high_cardinality_categorical_columns(X, categorical_columns)
    if high_cardinality_columns:
        X = X.drop(columns=high_cardinality_columns)
        dropped_columns += high_cardinality_columns
        categorical_columns = [column for column in categorical_columns if column not in high_cardinality_columns]

    categorical_encoder = categorical_ordinal_encoder() if is_tab_transformer else dense_one_hot_encoder()
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

    validation_size = 0.3
    stratify_target = y if pd.Series(y).nunique(dropna=True) > 1 else None
    X_train, X_val, y_train, y_val = train_test_split(
        X,
        y,
        test_size=validation_size,
        random_state=42,
        stratify=stratify_target,
    )

    model = None

    if algo == 'random_forest':
        model = RandomForestClassifier(
            n_estimators=20,
            max_depth=8,
            min_samples_leaf=2,
            n_jobs=1,
            random_state=42,
        )
    elif algo == 'logistic_regression' or algo == 'logistic':
        model = LogisticRegression(max_iter=1000)
    elif algo == 'knn' or algo == 'knearest' or algo == 'k-nearest':
        model = KNeighborsClassifier()
    elif algo == 'svm' or algo == 'svc':
        model = SVC(probability=True)
    elif algo == 'mlp' or algo == 'mlp_classifier' or algo == 'neural_network':
        model = MLPClassifier(hidden_layer_sizes=(100,), max_iter=300)
    elif algo == 'tab_transformer' or algo == 'tabtransformer':
        model = TabTransformerClassifier()
    elif algo == 'naive_bayes' or algo == 'nb':
        model = GaussianNB()
    elif algo == 'xgboost':
        if xgb is None:
            raise RuntimeError('xgboost is not installed')
        model = xgb.XGBClassifier(
            eval_metric='logloss',
            n_estimators=50,
            max_depth=3,
            learning_rate=0.08,
            subsample=0.9,
            colsample_bytree=0.9,
            n_jobs=1,
            random_state=42,
        )
    elif algo == 'lightgbm' or algo == 'lgbm':
        if lgb is None:
            raise RuntimeError('lightgbm is not installed')
        model = lgb.LGBMClassifier()
    else:
        raise ValueError(f'Unknown model type: {model_type}')

    pipeline_steps = [("preprocessor", preprocessor)]
    if is_tab_transformer:
        pipeline_steps.append(("scaler", StandardScaler()))
    pipeline_steps.append(("model", model))
    pipeline = Pipeline(steps=pipeline_steps)

    pipeline.fit(X_train, y_train)

    preds = None
    try:
        preds = pipeline.predict(X_val)
    except Exception:
        # some models may only provide predict_proba; try thresholding
        preds = (pipeline.predict_proba(X_val)[:, 1] > 0.5).astype(int)

    labels = sorted(pd.Series(y).dropna().unique().tolist(), key=lambda item: str(item))
    metrics = build_training_metrics(
        pipeline=pipeline,
        X_val=X_val,
        y_val=y_val,
        preds=preds,
        labels=labels,
    )
    if is_tab_transformer:
        metrics["top_predictors"] = equal_predictor_contributions_table(X_val.columns)
    else:
        metrics["top_predictors"] = top_predictor_contributions(
            pipeline,
            numeric_columns,
            categorical_columns,
            X_val=X_val,
            y_val=y_val,
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
        "row_count": int(len(df)),
        "training_row_count": int(len(X_train)),
        "validation_row_count": int(len(X_val)),
        "validation_size": validation_size,
        "feature_count": int(len(X.columns)),
        "numeric_feature_count": int(len(numeric_columns)),
        "categorical_feature_count": int(len(categorical_columns)),
        "high_cardinality_limit": MAX_CATEGORICAL_UNIQUE_VALUES,
        "row_limit": MAX_LOCAL_TRAINING_ROWS or None,
        "model_parameters": json_safe(model.get_params()),
        "top_predictors": metrics["top_predictors"],
        "dataset_cleaning": dataset_cleaning,
    }
    meta_path = model_path + ".meta.json"
    with open(meta_path, 'w') as mf:
        json.dump(metadata, mf)

    return {"model_path": model_path, "metrics": metrics, "metadata": metadata}


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
