from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

import trainer

from apps.patients.models import Patient
from apps.perioperative.models import PerioperativeRecord
from apps.predictions.models import PredictionResult
from apps.predictions.services import run_prediction

from .common import bool_value, cors, float_value, int_or_none, int_value, json_body, require_login
from .dataset_history import dataset_prediction_history_payloads
from .models import ModelArtifact
from .serializers import prediction_history_payload
from .training_views import validate_uploaded_dataset_path


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
    if not bool_value(payload.get("persist", True)):
        return cors(JsonResponse(prediction_response_payload(result)))

    result = persist_prediction(features, payload, result)
    return cors(JsonResponse(prediction_response_payload(result)))


@csrf_exempt
def predict_dataset_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    dataset_path = payload.get("dataset_path")
    target_column = str(payload.get("target") or payload.get("target_column") or "").strip()
    if not dataset_path:
        return cors(JsonResponse({"error": "dataset_path required"}, status=400))

    dataset_error = validate_uploaded_dataset_path(dataset_path)
    if dataset_error:
        return cors(JsonResponse({"error": dataset_error}, status=400))

    try:
        dataframe = trainer.read_dataset(dataset_path)
    except Exception as exc:
        return cors(JsonResponse({"error": str(exc)}, status=400))

    feature_columns = list(dataframe.columns)
    if target_column and target_column in feature_columns:
        feature_columns.remove(target_column)

    predictions = []
    errors = []
    for index, row in dataframe.iterrows():
        features = {str(column): clean_dataset_value(row[column]) for column in feature_columns}
        try:
            result = run_prediction(features)
            predictions.append({
                "row_index": int(index),
                "predicted_probability": result.get("predicted_probability"),
                "predicted_class": result.get("predicted_class"),
                "risk_level": result.get("risk_level"),
                "recommendations": result.get("recommendations") or [],
                "contributing_factors": result.get("contributing_factors") or [],
                "active_model": result.get("active_model"),
                "model_type": result.get("model_type"),
                "training_metrics": result.get("training_metrics") or {},
            })
        except Exception as exc:
            errors.append({"row_index": int(index), "error": str(exc)})

    risk_counts = {"High": 0, "Moderate": 0, "Low": 0}
    for prediction in predictions:
        risk = prediction.get("risk_level")
        if risk in risk_counts:
            risk_counts[risk] += 1

    return cors(JsonResponse({
        "predictions": predictions,
        "errors": errors[:25],
        "summary": {
            "total_rows": int(len(dataframe)),
            "predicted_rows": len(predictions),
            "failed_rows": len(errors),
            "high_risk_rows": risk_counts["High"],
            "moderate_risk_rows": risk_counts["Moderate"],
            "low_risk_rows": risk_counts["Low"],
            "active_model": predictions[0].get("active_model") if predictions else None,
            "model_type": predictions[0].get("model_type") if predictions else None,
            "training_metrics": predictions[0].get("training_metrics") if predictions else {},
        },
    }))


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


def clean_dataset_value(value):
    if value is None:
        return None
    try:
        if hasattr(value, "item"):
            value = value.item()
    except ValueError:
        pass
    if isinstance(value, float) and value != value:
        return None
    return value


def prediction_response_payload(result):
    payload = dict(result)
    payload.pop("risk_level", None)
    return payload


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
