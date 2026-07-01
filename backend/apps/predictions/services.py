from ml.model_loader import load_model_assets
from ml.predict import make_prediction_with_probabilities, make_predictions


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
    probability_info, contributing_factors = make_prediction_with_probabilities(
        payload=payload,
        model=model,
        preprocessor=preprocessor,
        feature_order=feature_order,
    )
    return build_prediction_result(probability_info, contributing_factors, preprocessor)


def prediction_results_from_assets(payloads: list[dict], model, preprocessor, feature_order) -> list[dict]:
    batch_results = make_predictions(
        payloads=payloads,
        model=model,
        preprocessor=preprocessor,
        feature_order=feature_order,
    )
    return [
        build_prediction_result(probability_info, contributing_factors, preprocessor)
        for probability_info, contributing_factors in batch_results
    ]


def build_prediction_result(probability_info, contributing_factors: list[dict], preprocessor: dict) -> dict:
    if isinstance(probability_info, dict):
        raw_probability = float(probability_info.get("raw_probability"))
        calibrated_probability = float(probability_info.get("calibrated_probability"))
    else:
        raw_probability = float(probability_info)
        calibrated_probability = float(probability_info)
    threshold = float(preprocessor.get("selected_threshold") or 0.50)
    predicted_class = "Yes" if calibrated_probability >= threshold else "No"
    risk_level = classify_risk(calibrated_probability)
    recommendations = build_recommendations(risk_level)

    return {
        "raw_probability": raw_probability,
        "calibrated_probability": calibrated_probability,
        "display_probability": display_probability(calibrated_probability),
        "predicted_probability": calibrated_probability,
        "predicted_class": predicted_class,
        "selected_threshold": threshold,
        "risk_level": risk_level,
        "recommendations": recommendations,
        "contributing_factors": contributing_factors,
        "active_model": preprocessor.get("_model_name"),
        "model_name": preprocessor.get("_model_name"),
        "model_version": preprocessor.get("model_version") or preprocessor.get("_model_name"),
        "model_type": preprocessor.get("_model_type"),
        "training_metrics": preprocessor.get("_training_metrics") or {},
        "used_trained_model": bool(preprocessor.get("_used_trained_model")),
    }


def display_probability(probability: float) -> str:
    probability = float(probability)
    if probability <= 0.01:
        return "<1%"
    if probability >= 0.99:
        return ">99%"
    return f"{probability * 100:.1f}%"
