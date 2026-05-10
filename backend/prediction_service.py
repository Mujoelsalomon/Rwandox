from typing import Dict, Any, Optional
import json
import numpy as np

from preprocessor import preprocess
from model_registry import load_model, predict_proba

try:
    import shap
except Exception:
    shap = None


class PredictionService:
    def __init__(self, model_path: str, model_type: str):
        self.model_path = model_path
        self.model_type = model_type.lower()
        self.model = None

    def _ensure_model(self):
        if self.model is None:
            self.model = load_model(self.model_path, self.model_type)

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Run preprocessing, model prediction, risk assignment, and SHAP explanation.

        Returns a dict with keys: probability, risk_level, shap (optional)
        """
        self._ensure_model()
        X = preprocess(features)

        probs = predict_proba(self.model, X)
        # Ensure scalar
        prob = float(np.asarray(probs).ravel()[0])

        # Simple risk assignment thresholds (can be customized)
        if prob < 0.3:
            risk = "Low Risk" 
            style = "color: green;"
        elif prob < 0.5:
            risk = "Medium Risk"
            style = "color: yellow;"
        else:
            risk = "High Risk"
            style = "color: red;"
        # Try generate SHAP explanation (best-effort)
        shap_values = None
        if shap is not None:
            try:
                # Use appropriate explainer depending on model
                if hasattr(self.model, "predict_proba"):
                    explainer = shap.Explainer(self.model, X)
                else:
                    explainer = shap.Explainer(self.model, X)
                sv = explainer(X)
                # Convert to JSON-serializable summary: list of (feature, value, shap_value)
                shap_values = []
                for i, col in enumerate(X.columns):
                    shap_values.append({
                        "feature": col,
                        "value": (X.iloc[0, i]).item() if hasattr(X.iloc[0, i], "item") else X.iloc[0, i],
                        "shap": float(sv.values[0, i]) if hasattr(sv.values, "__len__") else float(sv.values[0])
                    })
            except Exception:
                shap_values = None

        return {"probability": prob, "risk_level": risk, "shap": shap_values}
