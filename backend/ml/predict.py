import pandas as pd


DISPLAY_LABELS = {
    "postop_spo2": "Post-op SpO2",
    "asa_class": "ASA class",
    "urgency": "Urgency",
    "surgery_duration": "Surgery duration",
    "bmi": "BMI",
    "opioid_use": "Opioid use",
    "baseline_spo2": "Baseline SpO2",
    "respiratory_rate": "Respiratory rate",
    "oxygen_before_prediction": "Oxygen before prediction",
}


def _fallback_prediction(payload):
    postop_spo2 = payload.get("postop_spo2") or 98
    asa = str(payload.get("asa_class") or "").upper()
    urgency = str(payload.get("urgency") or "").lower()
    duration = payload.get("surgery_duration") or 0
    bmi = payload.get("bmi") or 0
    opioid_use = bool(payload.get("opioid_use"))

    probability = 0.18
    factors = []

    if postop_spo2 <= 92:
        probability += 0.32
        factors.append({"feature": "postop_spo2", "display": f"Post-op SpO2 {postop_spo2}%", "impact": 0.32})
    if asa in {"III", "IV", "V"}:
        probability += 0.12
        factors.append({"feature": "asa_class", "display": f"ASA {asa}", "impact": 0.12})
    if urgency == "emergency":
        probability += 0.10
        factors.append({"feature": "urgency", "display": "Emergency surgery", "impact": 0.10})
    if duration >= 180:
        probability += 0.08
        factors.append({"feature": "surgery_duration", "display": f"Duration {duration} min", "impact": 0.08})
    if bmi >= 30:
        probability += 0.06
        factors.append({"feature": "bmi", "display": f"BMI {bmi}", "impact": 0.06})
    if opioid_use:
        probability += 0.05
        factors.append({"feature": "opioid_use", "display": "Opioid use", "impact": 0.05})

    probability = min(probability, 0.95)
    factors = sorted(factors, key=lambda x: abs(x["impact"]), reverse=True)[:5]
    return probability, factors, False


def _build_dataframe(payload, feature_order):
    row = {feature: payload.get(feature) for feature in feature_order}
    return pd.DataFrame([row], columns=feature_order)


def _build_contributing_factors(payload, feature_order):
    factors = []
    for feature in feature_order:
        value = payload.get(feature)
        if value in (None, "", []):
            continue
        label = DISPLAY_LABELS.get(feature, feature.replace("_", " ").title())
        factors.append({
            "feature": feature,
            "display": f"{label}: {value}",
            "impact": 0.0,
        })
    return factors[:5]


def make_prediction(payload, model=None, preprocessor=None, feature_order=None):
    """Predict from a fitted sklearn-compatible pipeline when available."""
    if model is None or not feature_order:
        probability, factors, used_model = _fallback_prediction(payload)
        return probability, factors, used_model

    try:
        X = _build_dataframe(payload, feature_order)
        if hasattr(model, "predict_proba"):
            probability = float(model.predict_proba(X)[0, 1])
        else:
            probability = float(model.predict(X)[0])
        probability = max(0.0, min(1.0, probability))
        factors = _build_contributing_factors(payload, feature_order)
        return probability, factors, True
    except Exception:
        probability, factors, used_model = _fallback_prediction(payload)
        return probability, factors, used_model
