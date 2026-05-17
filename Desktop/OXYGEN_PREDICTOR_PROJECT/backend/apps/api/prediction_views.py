from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.patients.models import Patient
from apps.perioperative.models import PerioperativeRecord
from apps.predictions.models import PredictionResult
from apps.predictions.services import run_prediction

from .common import bool_value, cors, float_value, int_or_none, int_value, json_body, require_login
from .dataset_history import dataset_prediction_history_payloads
from .models import ModelArtifact
from .serializers import prediction_history_payload


@csrf_exempt
def predict_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    features = payload.get("features") or payload
    result = run_prediction(features)
    result = persist_prediction(features, payload, result)
    return cors(JsonResponse(result))


def prediction_history_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error

    records = PredictionResult.objects.select_related("record", "record__patient").all()[:250]
    predictions = [prediction_history_payload(item) for item in records]
    if not predictions:
        predictions = dataset_prediction_history_payloads()
    return cors(JsonResponse({"predictions": predictions}))


def persist_prediction(features, payload, result):
    hospital_id = str(features.get("patient_coded_id") or features.get("hospital_id") or "KBH-UNKNOWN").strip() or "KBH-UNKNOWN"
    urgency = str(features.get("urgency") or "elective").lower()
    if urgency not in {"elective", "emergency"}:
        urgency = "emergency" if "emerg" in urgency else "elective"

    with transaction.atomic():
        patient, _ = Patient.objects.update_or_create(
            hospital_id=hospital_id,
            defaults={
                "age": int_value(features.get("age"), 0),
                "sex": str(features.get("sex") or "Unknown")[:10],
                "bmi": float_value(features.get("bmi")),
                "smoking_history": bool_value(features.get("smoking_history")),
                "comorbidities": str(features.get("comorbidities") or ""),
                "baseline_spo2": float_value(features.get("baseline_spo2")),
            },
        )
        record = PerioperativeRecord.objects.create(
            patient=patient,
            surgery_type=str(features.get("surgery_type") or "Not recorded")[:100],
            urgency=urgency,
            surgery_duration=max(0, int_value(features.get("surgery_duration"), 0)),
            blood_loss=str(features.get("blood_loss") or "")[:50],
            ward=str(features.get("ward") or "")[:50],
            anesthesia_type=str(features.get("anesthesia_type") or "Not recorded")[:50],
            asa_class=str(features.get("asa_class") or "")[:10],
            residual_effects=bool_value(features.get("residual_effects")),
            opioid_use=bool_value(features.get("opioid_use")),
            airway_event=str(features.get("airway_event") or "")[:100],
            recovery_status=str(features.get("recovery_status") or "")[:50],
            postop_spo2=float_value(features.get("postop_spo2")),
            respiratory_rate=int_or_none(features.get("respiratory_rate")),
            pain_status=str(features.get("pain_status") or "")[:50],
            consciousness=str(features.get("consciousness") or "")[:50],
            time_since_surgery=int_or_none(features.get("time_since_surgery")),
            oxygen_before_prediction=bool_value(features.get("oxygen_before_prediction")),
        )
        active_model = ModelArtifact.objects.filter(is_active=True).first()
        prediction = PredictionResult.objects.create(
            record=record,
            predicted_probability=float(result.get("predicted_probability") or result.get("probability") or 0),
            predicted_class=str(result.get("predicted_class") or ""),
            risk_level=str(result.get("risk_level") or ""),
            recommendations=result.get("recommendations") or [],
            contributing_factors=result.get("contributing_factors") or result.get("factors") or [],
            model_version=active_model.name if active_model else str(payload.get("model_type") or "v1.0"),
        )

    result["id"] = prediction.id
    result["patient_id"] = patient.hospital_id
    result["model_version"] = prediction.model_version
    result["generated_at"] = prediction.generated_at.isoformat()
    return result
