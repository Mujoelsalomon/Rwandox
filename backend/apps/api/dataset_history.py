import csv
from pathlib import Path

from django.conf import settings


VIRTUAL_DATASET_PATH = Path(settings.BASE_DIR) / "datasets" / "oxygen_ml_virtual_dataset_100.csv"


def dataset_prediction_history_payloads(limit=250):
    if not VIRTUAL_DATASET_PATH.exists():
        return []

    predictions = []
    with open(VIRTUAL_DATASET_PATH, newline="", encoding="utf-8") as dataset:
        for index, row in enumerate(csv.DictReader(dataset), start=1):
            oxygen_required = _bool(_get(row, "postoperative_oxygen_required", "oxygen_required"))
            probability = _dataset_probability(row, oxygen_required)
            risk_level = _risk_level(probability)
            predictions.append({
                "id": f"dataset-{index}",
                "patient_id": _get(row, "patient_coded_id", "hospital_id") or f"DATASET-{index:04d}",
                "age": _int(_get(row, "age_years", "age"), 0),
                "sex": row.get("sex") or "Unknown",
                "surgery_type": _get(row, "type_of_surgery_performed", "surgery_type") or "Not recorded",
                "patient_disposition": _get(row, "postoperative_destination", "ward") or _disposition(risk_level),
                "predicted_probability": probability,
                "risk_level": risk_level,
                "model_version": "oxygen-virtual-dataset",
                "generated_at": _dataset_generated_at(index),
                "recommendations": _dataset_recommendations(risk_level, oxygen_required),
                "contributing_factors": _dataset_contributing_factors(row),
            })
            if len(predictions) >= limit:
                break

    return predictions


def dataset_patient_payloads(limit=250):
    if not VIRTUAL_DATASET_PATH.exists():
        return []

    patients = []
    with open(VIRTUAL_DATASET_PATH, newline="", encoding="utf-8") as dataset:
        for index, row in enumerate(csv.DictReader(dataset), start=1):
            oxygen_required = _bool(_get(row, "postoperative_oxygen_required", "oxygen_required"))
            probability = _dataset_probability(row, oxygen_required)
            risk_level = _risk_level(probability)
            generated_at = _dataset_generated_at(index)
            patients.append({
                "id": f"dataset-patient-{index}",
                "hospital_id": _get(row, "patient_coded_id", "hospital_id") or f"DATASET-{index:04d}",
                "name": f"Patient {_get(row, 'patient_coded_id', 'hospital_id') or index}",
                "age": _int(_get(row, "age_years", "age"), 0),
                "sex": row.get("sex") or "Unknown",
                "bmi": _float(_get(row, "body_mass_index", "bmi")),
                "smoking_history": _bool(row.get("smoking_history")),
                "comorbidities": row.get("comorbidities") or "",
                "baseline_spo2": _float(_get(row, "baseline_room_air_spo2_percent", "baseline_spo2")),
                "ward": _get(row, "postoperative_destination", "ward") or _disposition(risk_level),
                "surgery_type": _get(row, "type_of_surgery_performed", "surgery_type") or "Not recorded",
                "risk_level": risk_level,
                "predicted_probability": probability,
                "last_assessment": generated_at,
                "latest_record": {
                    "surgery_type": _get(row, "type_of_surgery_performed", "surgery_type") or "Not recorded",
                    "urgency": _get(row, "surgery_status", "urgency") or "",
                    "surgery_duration": _int(_get(row, "duration_of_surgery_minutes", "surgery_duration"), 0),
                    "blood_loss": _get(row, "estimated_blood_loss_ml", "blood_loss") or "",
                    "ward": _get(row, "postoperative_destination", "ward") or "",
                    "procedure_date": generated_at[:10],
                    "anesthesia_type": row.get("anesthesia_type") or "",
                    "asa_class": row.get("asa_class") or "",
                },
            })
            if len(patients) >= limit:
                break

    return patients


def _dataset_probability(row, oxygen_required):
    score = 72 if oxygen_required else 24

    baseline_spo2 = _float(_get(row, "baseline_room_air_spo2_percent", "baseline_spo2")) or 100
    postop_spo2 = _float(row.get("postop_spo2")) or baseline_spo2
    duration = _int(_get(row, "duration_of_surgery_minutes", "surgery_duration"), 0)
    respiratory_rate = _int(_get(row, "baseline_respiratory_rate_bpm", "respiratory_rate"), 0)

    if baseline_spo2 < 94:
        score += 8
    if postop_spo2 < 92:
        score += 12
    if duration >= 180:
        score += 8
    if respiratory_rate >= 24:
        score += 6
    if _bool(_get(row, "expected_intraoperative_opioid_use", "opioid_use")):
        score += 5
    if _bool(row.get("residual_effects")):
        score += 5
    if str(_get(row, "surgery_status", "urgency") or "").lower() == "emergency":
        score += 6

    return max(5, min(95, round(score)))


def _risk_level(probability):
    if probability < 30:
        return "Low"
    if probability < 70:
        return "Moderate"
    return "High"


def _dataset_recommendations(risk_level, oxygen_required):
    if risk_level == "High":
        return ["Immediate oxygen review", "Close postoperative monitoring"]
    if oxygen_required or risk_level == "Moderate":
        return ["Repeat SpO2 assessment", "Prepare supplemental oxygen if needed"]
    return ["Routine recovery monitoring"]


def _dataset_contributing_factors(row):
    factors = []
    if (_float(row.get("postop_spo2")) or 100) < 92:
        factors.append("Post-op SpO2 below 92%")
    if (_float(_get(row, "baseline_room_air_spo2_percent", "baseline_spo2")) or 100) < 94:
        factors.append("Low baseline SpO2")
    if _int(_get(row, "duration_of_surgery_minutes", "surgery_duration"), 0) >= 180:
        factors.append("Long surgery duration")
    if _bool(_get(row, "expected_intraoperative_opioid_use", "opioid_use")):
        factors.append("Opioid use")
    if _bool(row.get("residual_effects")):
        factors.append("Residual anesthetic effects")
    if str(_get(row, "surgery_status", "urgency") or "").lower() == "emergency":
        factors.append("Emergency surgery")
    return factors[:3] or ["Dataset oxygen requirement label"]


def _get(row, *keys):
    for key in keys:
        value = row.get(key)
        if value not in {"", None}:
            return value
    return ""


def _dataset_generated_at(index):
    day = 12 - ((index - 1) % 7)
    hour = 8 + ((index - 1) % 10)
    return f"2026-05-{day:02d}T{hour:02d}:30:00"


def _disposition(risk_level):
    risk = str(risk_level).lower()
    if "high" in risk:
        return "ICU"
    if "moderate" in risk:
        return "HDU"
    return "Ward"


def _bool(value):
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"true", "1", "yes", "y"}


def _float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _int(value, default):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default
