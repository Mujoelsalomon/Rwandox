import os
import time
import joblib
import json
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

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


def train_model(dataset_path: str, target_column: str = None, model_type: str = "random_forest") -> dict:
    """Train a model from the requested algorithm on provided CSV dataset.

    model_type: one of ['logistic_regression','random_forest','xgboost','lightgbm',
                         'knn','svm','mlp','tab_transformer','naive_bayes']

    Returns dict: {model_path, metrics, metadata}
    """
    df = pd.read_csv(dataset_path)

    if target_column is None:
        target_column = df.columns[-1]

    if target_column not in df.columns:
        raise ValueError(f"target column '{target_column}' not found in dataset")

    y = df[target_column]
    X = df.drop(columns=[target_column])

    # Basic preprocessing: fill na and one-hot for categoricals
    X = X.fillna(0)
    X = pd.get_dummies(X)

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    algo = model_type.lower()
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
        model = xgb.XGBClassifier(use_label_encoder=False, eval_metric='logloss')
    elif algo == 'lightgbm' or algo == 'lgbm':
        if lgb is None:
            raise RuntimeError('lightgbm is not installed')
        model = lgb.LGBMClassifier()
    elif algo == 'tab_transformer' or algo == 'tabtransformer':
        # Placeholder: Tab Transformer requires deep learning stack; not implemented here
        raise RuntimeError('Tab Transformer training is not implemented in this lightweight trainer')
    else:
        raise ValueError(f'Unknown model type: {model_type}')

    model.fit(X_train, y_train)

    preds = None
    try:
        preds = model.predict(X_val)
    except Exception:
        # some models may only provide predict_proba; try thresholding
        preds = (model.predict_proba(X_val)[:, 1] > 0.5).astype(int)

    acc = float(accuracy_score(y_val, preds))

    os.makedirs(os.path.join(os.path.dirname(__file__), "models"), exist_ok=True)
    ts = int(time.time())
    model_filename = f"{algo}_model_{ts}.joblib"
    model_path = os.path.join(os.path.dirname(__file__), "models", model_filename)
    joblib.dump(model, model_path)

    # Save metadata (columns used) for later alignment at prediction time
    metadata = {"columns": list(X.columns), "target": target_column, "algorithm": algo}
    meta_path = model_path + ".meta.json"
    with open(meta_path, 'w') as mf:
        json.dump(metadata, mf)

    return {"model_path": model_path, "metrics": {"val_accuracy": acc}, "metadata": metadata}
