from ml.model_loader import load_model_assets
from ml.predict import make_prediction, make_predictions


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
            "Book an ICU or HDU bed for closer postoperative monitoring.",
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
    model, preprocessor, feature_order = load_model_assets()
    return prediction_result_from_assets(payload, model, preprocessor, feature_order)


def prediction_result_from_assets(payload: dict, model, preprocessor, feature_order) -> dict:
    probability, contributing_factors = make_prediction(
        payload=payload,
        model=model,
        preprocessor=preprocessor,
        feature_order=feature_order,
    )
    return build_prediction_result(probability, contributing_factors, preprocessor)


def prediction_results_from_assets(payloads: list[dict], model, preprocessor, feature_order) -> list[dict]:
    batch_results = make_predictions(
        payloads=payloads,
        model=model,
        preprocessor=preprocessor,
        feature_order=feature_order,
    )
    return [
        build_prediction_result(probability, contributing_factors, preprocessor)
        for probability, contributing_factors in batch_results
    ]


def build_prediction_result(probability: float, contributing_factors: list[dict], preprocessor: dict) -> dict:
    predicted_class = "Yes" if probability >= 0.50 else "No"
    risk_level = classify_risk(probability)
    recommendations = build_recommendations(risk_level)

    return {
        "predicted_probability": round(float(probability), 4),
        "predicted_class": predicted_class,
        "risk_level": risk_level,
        "recommendations": recommendations,
        "contributing_factors": contributing_factors,
        "active_model": preprocessor.get("_model_name"),
        "model_type": preprocessor.get("_model_type"),
        "training_metrics": preprocessor.get("_training_metrics") or {},
        "used_trained_model": bool(preprocessor.get("_used_trained_model")),
    }
