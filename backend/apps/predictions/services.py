from apps.api.models import ModelArtifact
from ml.model_loader import load_model_assets
from ml.predict import make_prediction


def _get_active_artifact():
    return ModelArtifact.objects.filter(is_active=True).order_by("-created_at").first()


def classify_risk(probability: float) -> str:
    if probability < 0.30:
        return "Low"
    if probability < 0.70:
        return "Moderate"
    return "High"


def build_recommendations(risk_level: str) -> list[str]:
    if risk_level == "High":
        return [
            "Start close oxygen monitoring immediately.",
            "Prepare supplemental oxygen in PACU or ward.",
            "Repeat SpO2 and respiratory rate within 15 minutes.",
            "Escalate clinical review if saturation remains below target.",
        ]
    if risk_level == "Moderate":
        return [
            "Continue close monitoring.",
            "Repeat SpO2 assessment.",
            "Prepare oxygen if clinical condition worsens.",
        ]
    return [
        "Continue routine postoperative monitoring.",
        "Reassess according to ward protocol.",
    ]


def run_prediction(payload: dict) -> dict:
    artifact = _get_active_artifact()
    model = None
    preprocessor = None
    feature_order = None
    metadata = {}

    if artifact:
        model, preprocessor, feature_order, metadata = load_model_assets(artifact.path)

    probability, contributing_factors, used_trained_model = make_prediction(
        payload=payload,
        model=model,
        preprocessor=preprocessor,
        feature_order=feature_order,
    )
    predicted_class = "Yes" if probability >= 0.50 else "No"
    risk_level = classify_risk(probability)
    recommendations = build_recommendations(risk_level)

    response = {
        "predicted_probability": round(float(probability), 4),
        "predicted_class": predicted_class,
        "risk_level": risk_level,
        "recommendations": recommendations,
        "contributing_factors": contributing_factors,
        "used_trained_model": used_trained_model,
    }
    if artifact:
        response["active_model"] = {
            "id": artifact.id,
            "name": artifact.name,
            "model_type": artifact.model_type,
            "target": metadata.get("target"),
        }
    return response
