from apps.accounts.models import ensure_user_profile

from .common import float_value


CLINICAL_ROLE_NAMES = ["Doctor", "Nurse", "Anesthetist", "Researcher", "Data manager"]
ADMIN_PERMISSIONS = [
    "Manage users",
    "Manage active model",
    "Monitor model status",
    "View audit logs",
    "Manage QR-code access",
    "Manage settings",
]
ROLE_PERMISSIONS = {
    "Doctor": [
        "Review prediction result",
        "Support monitoring decision",
        "Support disposition decision",
    ],
    "Anesthetist": [
        "Login",
        "Enter patient data",
        "Generate prediction",
        "View prediction result",
        "View key factors",
        "Review prediction history",
    ],
    "Researcher": [
        "Upload dataset",
        "Train model",
        "View training results",
        "Compare models",
    ],
    "Data manager": [
        "Upload dataset",
        "Train model",
        "View training results",
        "Compare models",
    ],
}


def user_payload(user):
    role = "Superuser" if user.is_superuser else "Administrator" if user.is_staff else clinical_role(user)
    profile = ensure_user_profile(user)
    permissions = ADMIN_PERMISSIONS if user.is_staff or user.is_superuser else ROLE_PERMISSIONS.get(role, [])
    return {
        "id": user.id,
        "user_id": profile.user_code,
        "username": user.username,
        "email": user.email,
        "name": user.get_full_name() or user.first_name or user.username,
        "role": role,
        "access_level": "Administrator" if user.is_staff or user.is_superuser else "Clinical user",
        "permissions": permissions,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "is_active": user.is_active,
        "must_change_password": profile.must_change_password,
        "date_joined": user.date_joined.isoformat() if user.date_joined else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "password_status": "Masked",
        "password_display": "********",
    }


def clinical_role(user):
    group_names = set(user.groups.values_list("name", flat=True))
    return next((role for role in CLINICAL_ROLE_NAMES if role in group_names), "Doctor")


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
