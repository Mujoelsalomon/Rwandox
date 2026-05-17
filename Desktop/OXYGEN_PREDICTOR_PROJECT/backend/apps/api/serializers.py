from .common import float_value


def user_payload(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "name": user.get_full_name() or user.first_name or user.username,
        "role": "Administrator" if user.is_staff else "Clinician",
    }


def patient_payload(patient):
    latest_record = patient.perioperative_records.first()
    latest_prediction = getattr(latest_record, "prediction", None) if latest_record else None
    risk_level = latest_prediction.risk_level if latest_prediction else "Not assessed"

    return {
        "id": patient.id,
        "hospital_id": patient.hospital_id,
        "name": f"Patient {patient.hospital_id}",
        "age": patient.age,
        "sex": patient.sex,
        "bmi": patient.bmi,
        "smoking_history": patient.smoking_history,
        "comorbidities": patient.comorbidities,
        "baseline_spo2": patient.baseline_spo2,
        "ward": latest_record.ward if latest_record else "",
        "surgery_type": latest_record.surgery_type if latest_record else "",
        "risk_level": risk_level,
        "predicted_probability": _percentage(latest_prediction.predicted_probability) if latest_prediction else 0,
        "last_assessment": latest_prediction.generated_at.isoformat() if latest_prediction else patient.created_at.isoformat(),
        "latest_record": record_payload(latest_record) if latest_record else None,
    }


def record_payload(record):
    return {
        "surgery_type": record.surgery_type,
        "urgency": record.urgency,
        "surgery_duration": record.surgery_duration,
        "blood_loss": record.blood_loss,
        "ward": record.ward,
        "procedure_date": record.procedure_date.isoformat() if record.procedure_date else "",
        "anesthesia_type": record.anesthesia_type,
        "asa_class": record.asa_class,
    }


def prediction_history_payload(prediction):
    record = prediction.record
    patient = record.patient
    return {
        "id": prediction.id,
        "patient_id": patient.hospital_id,
        "age": patient.age,
        "sex": patient.sex,
        "surgery_type": record.surgery_type,
        "patient_disposition": disposition(prediction.risk_level),
        "predicted_probability": _percentage(prediction.predicted_probability),
        "risk_level": prediction.risk_level,
        "model_version": prediction.model_version,
        "generated_at": prediction.generated_at.isoformat(),
        "recommendations": prediction.recommendations,
        "contributing_factors": prediction.contributing_factors,
    }


def disposition(risk_level):
    risk = str(risk_level).lower()
    if "high" in risk:
        return "ICU"
    if "moderate" in risk:
        return "HDU"
    return "Ward"


def _percentage(value):
    number = float_value(value) or 0
    if number <= 1:
        number *= 100
    return round(number)
