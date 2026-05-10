import json
import os
import time

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer, make_column_selector
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.svm import SVC

try:
    import xgboost as xgb
except Exception:
    xgb = None

try:
    import lightgbm as lgb
except Exception:
    lgb = None


def _build_estimator(algo: str):
    if algo == "random_forest":
        return RandomForestClassifier(n_estimators=100, random_state=42)
    if algo in {"logistic_regression", "logistic"}:
        return LogisticRegression(max_iter=1000)
    if algo in {"knn", "knearest", "k-nearest"}:
        return KNeighborsClassifier()
    if algo in {"svm", "svc"}:
        return SVC(probability=True)
    if algo in {"mlp", "mlp_classifier", "neural_network"}:
        return MLPClassifier(hidden_layer_sizes=(100,), max_iter=300)
    if algo in {"naive_bayes", "nb"}:
        return GaussianNB()
    if algo == "xgboost":
        if xgb is None:
            raise RuntimeError("xgboost is not installed")
        return xgb.XGBClassifier(use_label_encoder=False, eval_metric="logloss")
    if algo in {"lightgbm", "lgbm"}:
        if lgb is None:
            raise RuntimeError("lightgbm is not installed")
        return lgb.LGBMClassifier()
    if algo in {"tab_transformer", "tabtransformer"}:
        raise RuntimeError("Tab Transformer training is not implemented in this lightweight trainer")
    raise ValueError(f"Unknown model type: {algo}")


def _build_pipeline(estimator):
    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
        ]
    )
    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, make_column_selector(dtype_include=["number", "bool"])),
            ("cat", categorical_transformer, make_column_selector(dtype_exclude=["number", "bool"])),
        ],
        remainder="drop",
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", estimator),
        ]
    )


def _load_dataset(dataset_path: str) -> pd.DataFrame:
    extension = os.path.splitext(dataset_path)[1].lower()

    if extension == ".csv":
        return pd.read_csv(dataset_path)
    if extension in {".tsv", ".tab"}:
        return pd.read_csv(dataset_path, sep="\t")
    if extension == ".txt":
        return pd.read_csv(dataset_path, sep=None, engine="python")
    if extension == ".json":
        return pd.read_json(dataset_path)
    if extension == ".jsonl":
        return pd.read_json(dataset_path, lines=True)
    if extension in {".xlsx", ".xls"}:
        return pd.read_excel(dataset_path)

    raise ValueError(
        "Unsupported dataset format. Use CSV, TSV, TXT, JSON, JSONL, XLS, or XLSX."
    )


def train_model(dataset_path: str, target_column: str = None, model_type: str = "random_forest") -> dict:
    """Train a pipeline from a tabular dataset and persist the fitted artifact."""
    df = _load_dataset(dataset_path)

    if target_column is None:
        target_column = df.columns[-1]

    if target_column not in df.columns:
        raise ValueError(f"target column '{target_column}' not found in dataset")

    y = df[target_column]
    X = df.drop(columns=[target_column]).copy()

    algo = model_type.lower()
    estimator = _build_estimator(algo)
    pipeline = _build_pipeline(estimator)

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    pipeline.fit(X_train, y_train)

    try:
        preds = pipeline.predict(X_val)
    except Exception:
        preds = (pipeline.predict_proba(X_val)[:, 1] > 0.5).astype(int)

    acc = float(accuracy_score(y_val, preds))

    os.makedirs(os.path.join(os.path.dirname(__file__), "models"), exist_ok=True)
    ts = int(time.time())
    model_filename = f"{algo}_model_{ts}.joblib"
    model_path = os.path.join(os.path.dirname(__file__), "models", model_filename)
    joblib.dump(pipeline, model_path)

    metadata = {
        "raw_columns": list(X.columns),
        "target": target_column,
        "algorithm": algo,
        "class_labels": [str(value) for value in pd.Series(y).dropna().unique().tolist()],
    }
    meta_path = model_path + ".meta.json"
    with open(meta_path, "w", encoding="utf-8") as mf:
        json.dump(metadata, mf)

    metrics = {
        "val_accuracy": acc,
        "training_rows": int(len(df)),
        "feature_count": int(len(X.columns)),
    }

    return {"model_path": model_path, "metrics": metrics, "metadata": metadata}
