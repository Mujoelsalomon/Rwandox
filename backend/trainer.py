import os
import time
import joblib
import json
import math
import pandas as pd
import numpy as np
from sklearn.compose import ColumnTransformer
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
from sklearn.preprocessing import LabelEncoder, OneHotEncoder
from sklearn.impute import SimpleImputer

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


def read_dataset(dataset_path: str, **kwargs) -> pd.DataFrame:
    """Read a training dataset from a supported tabular file."""
    extension = os.path.splitext(str(dataset_path))[1].lower()
    if extension == ".xlsx":
        try:
            return pd.read_excel(dataset_path, engine="openpyxl", **kwargs)
        except ImportError as exc:
            raise RuntimeError(
                "Excel XLSX support is not active in the running backend. Install backend requirements, "
                "restart the backend server, and upload the dataset again."
            ) from exc
    if extension == ".xls":
        try:
            return pd.read_excel(dataset_path, engine="xlrd", **kwargs)
        except ImportError as exc:
            raise RuntimeError(
                "Excel XLS support is not active in the running backend. Install backend requirements, "
                "restart the backend server, and upload the dataset again."
            ) from exc
    if extension in {".tsv", ".tab"}:
        return pd.read_csv(dataset_path, sep="\t", **kwargs)
    if extension == ".jsonl":
        return pd.read_json(dataset_path, lines=True, **kwargs)
    if extension == ".json":
        return pd.read_json(dataset_path, **kwargs)
    return pd.read_csv(dataset_path, **kwargs)


def dataset_columns(dataset_path: str) -> list[str]:
    df = read_dataset(dataset_path, nrows=0)
    return [str(column) for column in df.columns]


def default_target_column(columns) -> str:
    preferred_targets = {
        "postoperative_oxygen_required",
        "oxygen_required",
        "oxygen_requirement",
        "requires_oxygen",
        "target",
        "label",
        "outcome",
    }
    for column in columns:
        if str(column).lower() in preferred_targets:
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

    missing_target = cleaned[target_column].isna()
    report["dropped_missing_target_row_count"] = int(missing_target.sum())
    if report["dropped_missing_target_row_count"]:
        cleaned = cleaned.loc[~missing_target].copy()

    if cleaned.empty:
        raise ValueError("dataset has no rows after cleaning missing target values")

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
    for column in column_list:
        if str(column).lower() == lowered:
            return column
    return requested


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
    id_columns = [
        column for column in X.columns
        if column.lower() in {"id", "hospital_id", "patient_id", "patient_coded_id"}
        or column.lower().endswith("_id")
    ]
    leakage_columns = [
        column for column in X.columns
        if column.lower() in {
            "date_of_discharge_or_death",
            "oxygen_need_probability",
            "oxygen_duration_hours",
            "risk_classification",
            "brief_recommendation",
        }
    ]
    dropped_columns = id_columns + leakage_columns
    if dropped_columns:
        X = X.drop(columns=dropped_columns)

    algo = model_type.lower()
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

    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", SimpleImputer(strategy="median"), numeric_columns),
            (
                "categorical",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", dense_one_hot_encoder()),
                    ]
                ),
                categorical_columns,
            ),
        ],
        remainder="drop",
        sparse_threshold=0.0,
    )

    validation_size = 0.2
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=validation_size, random_state=42)

    model = None

    if algo == 'random_forest':
        model = RandomForestClassifier(n_estimators=100, random_state=42)
    elif algo == 'logistic_regression' or algo == 'logistic':
        model = LogisticRegression(max_iter=1000)
    elif algo == 'knn' or algo == 'knearest' or algo == 'k-nearest':
        model = KNeighborsClassifier()
    elif algo == 'svm' or algo == 'svc':
        model = SVC(probability=True)
    elif algo == 'mlp' or algo == 'mlp_classifier' or algo == 'neural_network':
        model = MLPClassifier(hidden_layer_sizes=(100,), max_iter=300)
    elif algo == 'naive_bayes' or algo == 'nb':
        model = GaussianNB()
    elif algo == 'xgboost':
        if xgb is None:
            raise RuntimeError('xgboost is not installed')
        model = xgb.XGBClassifier(
            eval_metric='logloss',
            n_estimators=80,
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
    elif algo == 'tab_transformer' or algo == 'tabtransformer':
        # Placeholder: Tab Transformer requires deep learning stack; not implemented here
        raise RuntimeError('Tab Transformer training is not implemented in this lightweight trainer')
    else:
        raise ValueError(f'Unknown model type: {model_type}')

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )

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
        "model_parameters": json_safe(model.get_params()),
        "dataset_cleaning": dataset_cleaning,
    }
    meta_path = model_path + ".meta.json"
    with open(meta_path, 'w') as mf:
        json.dump(metadata, mf)

    return {"model_path": model_path, "metrics": metrics, "metadata": metadata}


def build_training_metrics(pipeline, X_val, y_val, preds, labels) -> dict:
    matrix = confusion_matrix(y_val, preds, labels=labels)
    sensitivity = safe_float(recall_score(y_val, preds, average="weighted", zero_division=0))
    specificity = calculate_specificity(matrix)
    metrics = {
        "val_accuracy": safe_float(accuracy_score(y_val, preds)),
        "val_balanced_accuracy": safe_float(balanced_accuracy_score(y_val, preds)),
        "val_precision_weighted": safe_float(precision_score(y_val, preds, average="weighted", zero_division=0)),
        "val_precision_macro": safe_float(precision_score(y_val, preds, average="macro", zero_division=0)),
        "val_recall_weighted": sensitivity,
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
            metrics["val_roc_auc"] = safe_metric(lambda: roc_auc_score(y_val, probabilities[:, 1]))
        elif len(labels) > 2:
            metrics["val_roc_auc_weighted_ovr"] = safe_metric(
                lambda: roc_auc_score(y_val, probabilities, labels=labels, multi_class="ovr", average="weighted")
            )

    return metrics


def calculate_specificity(matrix):
    try:
        if matrix.shape == (2, 2):
            true_negative = float(matrix[0][0])
            false_positive = float(matrix[0][1])
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
