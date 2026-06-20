import pandas as pd


def make_prediction(payload, model=None, preprocessor=None, feature_order=None):
    if model is None:
        raise RuntimeError("No trained prediction model is available.")

    feature_order = feature_order or []
    row = {feature: _normalize_value(feature, payload.get(feature)) for feature in feature_order}
    frame = pd.DataFrame([row], columns=feature_order)

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(frame)[0]
        classes = _class_labels(model, preprocessor)
        positive_index = _positive_class_index(classes, probabilities)
        probability = float(probabilities[positive_index])
    else:
        probability = float(model.predict(frame)[0])

    factors = _contributing_factors(row)
    return max(0.0, min(1.0, probability)), factors


def make_predictions(payloads, model=None, preprocessor=None, feature_order=None):
    if model is None:
        raise RuntimeError("No trained prediction model is available.")

    feature_order = feature_order or []
    rows = [
        {feature: _normalize_value(feature, payload.get(feature)) for feature in feature_order}
        for payload in payloads
    ]
    frame = pd.DataFrame(rows, columns=feature_order)

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(frame)
        classes = _class_labels(model, preprocessor)
        positive_index = _positive_class_index(classes, probabilities[0]) if len(probabilities) else 0
        positive_probabilities = probabilities[:, positive_index]
    else:
        positive_probabilities = model.predict(frame)

    results = []
    for row, probability in zip(rows, positive_probabilities):
        normalized_probability = max(0.0, min(1.0, float(probability)))
        results.append((normalized_probability, _contributing_factors(row)))
    return results


def _class_labels(model, metadata):
    labels = (metadata or {}).get("class_labels")
    if labels:
        return labels
    return list(getattr(model, "classes_", [0, 1]))


def _positive_class_index(classes, probabilities):
    normalized_classes = [str(item).strip().lower() for item in classes]
    positive_labels = {"1", "yes", "true", "required", "oxygen required", "postoperative oxygen required"}
    for index, label in enumerate(normalized_classes):
        if label in positive_labels:
            return index
    return len(probabilities) - 1


def _normalize_value(feature, value):
    if value in {"", None}:
        return _default_value(feature)
    if feature in _BOOLEAN_FEATURES:
        return bool(value)
    if feature in _NUMERIC_FEATURES:
        try:
            return float(value)
        except (TypeError, ValueError):
            return _default_value(feature)
    return value


_BOOLEAN_FEATURES = {"smoking_history", "residual_effects", "opioid_use", "oxygen_before_prediction"}


_NUMERIC_FEATURES = {
    "age",
    "age_years",
    "weight_kg",
    "height_cm",
    "bmi",
    "body_mass_index",
    "baseline_spo2",
    "baseline_room_air_spo2_percent",
    "baseline_respiratory_rate_bpm",
    "baseline_heart_rate_bpm",
    "baseline_systolic_bp_mmhg",
    "baseline_diastolic_bp_mmhg",
    "preoperative_hemoglobin_gdl",
    "surgery_duration",
    "duration_of_surgery_minutes",
    "estimated_blood_loss_ml",
    "expected_intraoperative_fluid_volume_ml",
    "postop_spo2",
    "respiratory_rate",
    "time_since_surgery",
}


def _default_value(feature):
    defaults = {
        "age": 50,
        "age_years": 50,
        "sex": "Female",
        "weight_kg": 70,
        "height_cm": 165,
        "bmi": 25,
        "body_mass_index": 25,
        "smoking_history": False,
        "comorbidities": "None",
        "baseline_spo2": 97,
        "baseline_room_air_spo2_percent": 97,
        "baseline_respiratory_rate_bpm": 18,
        "baseline_heart_rate_bpm": 80,
        "baseline_systolic_bp_mmhg": 120,
        "baseline_diastolic_bp_mmhg": 80,
        "preoperative_hemoglobin_gdl": 13,
        "surgery_type": "Abdominal",
        "urgency": "elective",
        "surgery_duration": 90,
        "duration_of_surgery_minutes": 90,
        "estimated_blood_loss_ml": 0,
        "blood_loss": "Minimal",
        "ward": "Surgical Ward",
        "anesthesia_type": "General",
        "asa_class": "II",
        "residual_effects": False,
        "opioid_use": False,
        "airway_event": "None",
        "recovery_status": "Stable",
        "postop_spo2": 97,
        "respiratory_rate": 18,
        "pain_status": "Mild",
        "consciousness": "Alert",
        "time_since_surgery": 60,
        "oxygen_before_prediction": False,
    }
    return defaults.get(feature, "None")


def _contributing_factors(row):
    checks = [
        ("postop_spo2", _number(_first_value(row, "postop_spo2", "baseline_room_air_spo2_percent"), 97) <= 92, f"Post-op SpO2 {_first_value(row, 'postop_spo2', 'baseline_room_air_spo2_percent')}%"),
        ("baseline_spo2", _number(_first_value(row, "baseline_spo2", "baseline_room_air_spo2_percent"), 97) <= 94, f"Baseline SpO2 {_first_value(row, 'baseline_spo2', 'baseline_room_air_spo2_percent')}%"),
        ("asa_class", str(row.get("asa_class", "")).upper() in {"III", "IV", "V"}, f"ASA {row.get('asa_class')}"),
        ("urgency", str(_first_value(row, "urgency", "surgery_status")).lower() == "emergency", "Emergency surgery"),
        ("surgery_duration", _number(_first_value(row, "surgery_duration", "duration_of_surgery_minutes"), 0) >= 180, f"Duration {_first_value(row, 'surgery_duration', 'duration_of_surgery_minutes')} min"),
        ("bmi", _number(_first_value(row, "bmi", "body_mass_index"), 0) >= 30, f"BMI {_first_value(row, 'bmi', 'body_mass_index')}"),
        ("opioid_use", bool(row.get("opioid_use")), "Opioid use"),
        ("airway_event", str(row.get("airway_event", "None")) != "None", f"Airway event: {row.get('airway_event')}"),
    ]
    factors = []
    for index, (feature, present, display) in enumerate(checks):
        if present:
            factors.append({"feature": feature, "display": display, "impact": round(0.1 - index * 0.01, 2)})
    return factors[:5]


def _first_value(row, *features):
    for feature in features:
        value = row.get(feature)
        if value not in {"", None, "None"}:
            return value
    return None


def _number(value, fallback):
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback
