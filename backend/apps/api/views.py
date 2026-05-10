import os
import uuid
import threading
import time
from pathlib import Path
import json
from datetime import datetime

from django.http import JsonResponse, HttpResponse, FileResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.db import transaction

from apps.predictions.services import run_prediction
from apps.patients.models import Patient
from apps.perioperative.models import PerioperativeRecord
from apps.predictions.models import PredictionResult
import trainer
from typing import Optional
from .models import TrainingJob, ModelArtifact

MODELS_DIR = Path(settings.BASE_DIR) / "models"


def _cors(resp):
    resp["Access-Control-Allow-Origin"] = "*"
    resp["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


def _bool_value(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "present"}


def _float_or_none(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _int_or_none(value):
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _date_or_none(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError:
        return None


def _calculate_bmi(payload):
    bmi = _float_or_none(payload.get("bmi"))
    if bmi is not None:
        return bmi

    height = _float_or_none(payload.get("height"))
    weight = _float_or_none(payload.get("weight"))
    if not height or not weight:
        return None

    height_m = height / 100
    if height_m <= 0:
        return None
    return round(weight / (height_m * height_m), 1)


def _patient_payload(patient):
    latest_record = patient.perioperative_records.first()
    latest_prediction = getattr(latest_record, "prediction", None) if latest_record else None

    data = {
        "id": patient.id,
        "hospital_id": patient.hospital_id,
        "age": patient.age,
        "sex": patient.sex,
        "bmi": patient.bmi,
        "smoking_history": patient.smoking_history,
        "comorbidities": patient.comorbidities,
        "baseline_spo2": patient.baseline_spo2,
    }
    if latest_record:
        data["latest_record"] = {
            "id": latest_record.id,
            "surgery_type": latest_record.surgery_type,
            "urgency": latest_record.urgency,
            "surgery_duration": latest_record.surgery_duration,
            "blood_loss": latest_record.blood_loss,
            "ward": latest_record.ward,
            "procedure_date": latest_record.procedure_date.isoformat() if latest_record.procedure_date else None,
            "anesthesia_type": latest_record.anesthesia_type,
            "asa_class": latest_record.asa_class,
            "postop_spo2": latest_record.postop_spo2,
            "respiratory_rate": latest_record.respiratory_rate,
        }
    if latest_prediction:
        data["latest_prediction"] = {
            "predicted_probability": latest_prediction.predicted_probability,
            "predicted_class": latest_prediction.predicted_class,
            "risk_level": latest_prediction.risk_level,
            "recommendations": latest_prediction.recommendations,
            "contributing_factors": latest_prediction.contributing_factors,
        }
    return data


@csrf_exempt
def predict_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    if request.method != "POST":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        payload = request.POST.dict()

    features = payload.get("features") or payload
    result = run_prediction(features)
    return _cors(JsonResponse(result))


@csrf_exempt
def patient_assessment_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    if request.method != "POST":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        payload = request.POST.dict()

    should_generate_prediction = _bool_value(payload.get("generate_prediction", True))
    hospital_id = (payload.get("hospital_id") or payload.get("hospitalId") or "").strip()
    age = _int_or_none(payload.get("age"))
    sex = payload.get("sex") or ""
    if not hospital_id or age is None or not sex:
        return _cors(JsonResponse({"error": "hospital_id, age, and sex are required"}, status=400))

    bmi = _calculate_bmi(payload)
    patient, _created = Patient.objects.update_or_create(
        hospital_id=hospital_id,
        defaults={
            "age": age,
            "sex": sex,
            "bmi": bmi,
            "smoking_history": _bool_value(payload.get("smoking_history") or payload.get("smokingHistory")),
            "comorbidities": payload.get("comorbidities") or "",
            "baseline_spo2": _float_or_none(payload.get("baseline_spo2") or payload.get("baselineSpo2")),
        },
    )

    record = PerioperativeRecord.objects.create(
        patient=patient,
        surgery_type=payload.get("surgery_type") or payload.get("surgeryType") or "",
        urgency=str(payload.get("urgency") or "elective").lower(),
        surgery_duration=_int_or_none(payload.get("surgery_duration") or payload.get("duration")) or 0,
        blood_loss=payload.get("blood_loss") or payload.get("bloodLoss") or "",
        ward=payload.get("ward") or "",
        procedure_date=_date_or_none(payload.get("procedure_date") or payload.get("procedureDate")),
        anesthesia_type=payload.get("anesthesia_type") or payload.get("anesthesiaType") or "General",
        asa_class=payload.get("asa_class") or payload.get("asaClass") or "",
        residual_effects=_bool_value(payload.get("residual_effects") or payload.get("residualEffects")),
        opioid_use=_bool_value(payload.get("opioid_use") or payload.get("opioidUse")),
        airway_event=payload.get("airway_event") or payload.get("airwayEvent") or "",
        recovery_status=payload.get("recovery_status") or payload.get("recoveryStatus") or "",
        postop_spo2=_float_or_none(payload.get("postop_spo2") or payload.get("postopSpo2")),
        respiratory_rate=_int_or_none(payload.get("respiratory_rate") or payload.get("respiratoryRate")),
        pain_status=payload.get("pain_status") or payload.get("painStatus") or "",
        consciousness=payload.get("consciousness") or "",
        time_since_surgery=_int_or_none(payload.get("time_since_surgery") or payload.get("timeSinceSurgery")),
        oxygen_before_prediction=_bool_value(payload.get("oxygen_before_prediction") or payload.get("oxygenBeforePrediction")),
    )

    response = {
        "ok": True,
        "patient": _patient_payload(patient),
        "record_id": record.id,
        "prediction": None,
        "status": "draft_saved",
    }

    if should_generate_prediction:
        features = {
            "age": patient.age,
            "sex": patient.sex,
            "bmi": patient.bmi,
            "smoking_history": patient.smoking_history,
            "baseline_spo2": patient.baseline_spo2,
            "surgery_type": record.surgery_type,
            "urgency": record.urgency,
            "surgery_duration": record.surgery_duration,
            "blood_loss": record.blood_loss,
            "ward": record.ward,
            "anesthesia_type": record.anesthesia_type,
            "asa_class": record.asa_class,
            "residual_effects": record.residual_effects,
            "opioid_use": record.opioid_use,
            "airway_event": record.airway_event,
            "recovery_status": record.recovery_status,
            "postop_spo2": record.postop_spo2,
            "respiratory_rate": record.respiratory_rate,
            "pain_status": record.pain_status,
            "consciousness": record.consciousness,
            "time_since_surgery": record.time_since_surgery,
            "oxygen_before_prediction": record.oxygen_before_prediction,
        }
        prediction = run_prediction(features)
        PredictionResult.objects.create(
            record=record,
            predicted_probability=prediction["predicted_probability"],
            predicted_class=prediction["predicted_class"],
            risk_level=prediction["risk_level"],
            recommendations=prediction.get("recommendations", []),
            contributing_factors=prediction.get("contributing_factors", []),
            model_version=prediction.get("active_model", {}).get("name", "v1.0"),
        )
        response["prediction"] = prediction
        response["patient"] = _patient_payload(patient)
        response["status"] = "prediction_generated"

    return _cors(JsonResponse(response, status=201))


def patients_search_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    if request.method != "GET":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    query = (request.GET.get("q") or request.GET.get("hospital_id") or "").strip()
    qs = Patient.objects.all()
    if query:
        qs = qs.filter(hospital_id__icontains=query)

    patients = [_patient_payload(patient) for patient in qs[:25]]
    return _cors(JsonResponse({"patients": patients}))


def prediction_history_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    if request.method != "GET":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    query = (request.GET.get("q") or "").strip()
    risk = (request.GET.get("risk") or "").strip()
    disposition = (request.GET.get("ward") or request.GET.get("disposition") or "").strip()

    qs = PredictionResult.objects.select_related("record", "record__patient").all()
    if query:
        qs = qs.filter(record__patient__hospital_id__icontains=query)
    if risk and risk.lower() != "all":
        qs = qs.filter(risk_level__iexact=risk)
    if disposition and disposition.lower() != "all":
        qs = qs.filter(record__ward__iexact=disposition)

    predictions = []
    for prediction in qs[:200]:
        record = prediction.record
        patient = record.patient
        predictions.append({
            "id": prediction.id,
            "patient_id": patient.hospital_id,
            "age": patient.age,
            "sex": patient.sex,
            "surgery_type": record.surgery_type,
            "patient_disposition": record.ward,
            "procedure_date": record.procedure_date.isoformat() if record.procedure_date else None,
            "predicted_probability": prediction.predicted_probability,
            "predicted_class": prediction.predicted_class,
            "risk_level": prediction.risk_level,
            "recommendations": prediction.recommendations,
            "contributing_factors": prediction.contributing_factors,
            "model_version": prediction.model_version,
            "generated_at": prediction.generated_at.isoformat(),
        })

    return _cors(JsonResponse({"predictions": predictions}))


@csrf_exempt
def upload_dataset_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    if request.method != "POST":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    f = request.FILES.get("file")
    if not f:
        return _cors(JsonResponse({"error": "no file provided"}, status=400))

    uploads = Path(settings.MEDIA_ROOT) / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    dest = uploads / f.name
    with open(dest, "wb") as wf:
        for chunk in f.chunks():
            wf.write(chunk)

    return _cors(JsonResponse({"dataset_path": str(dest)}))


def _run_training(job_id: str, dataset_path: str, model_type: Optional[str]):
    try:
        job = TrainingJob.objects.get(job_id=job_id)
        job.status = "running"
        job.save()
    except TrainingJob.DoesNotExist:
        return

    try:
        # call the existing trainer to train and persist a real model
        target_column = job.result.get("target_column") if isinstance(job.result, dict) else None
        res = trainer.train_model(dataset_path, target_column=target_column, model_type=model_type or "random_forest")
        model_path = Path(res["model_path"])
        model_name = model_path.name

        with transaction.atomic():
            ModelArtifact.objects.update(is_active=False)
            artifact = ModelArtifact.objects.create(
                name=model_name,
                path=str(model_path),
                model_type=res.get("metadata", {}).get("algorithm") or model_type or "generic",
                metrics={
                    **(res.get("metrics") or {}),
                    "training_metadata": res.get("metadata") or {},
                },
                is_active=True,
            )

        job.status = "completed"
        job.result = {
            "model_name": model_name,
            "metrics": res.get("metrics"),
            "artifact_id": artifact.id,
            "target_column": res.get("metadata", {}).get("target"),
        }
        job.save()
    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        job.save()


@csrf_exempt
def train_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    if request.method != "POST":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        payload = {}

    dataset_path = payload.get("dataset_path")
    model_type = payload.get("model_type")
    target = payload.get("target")
    if not dataset_path:
        return _cors(JsonResponse({"error": "dataset_path required"}, status=400))

    job_id = uuid.uuid4().hex
    job = TrainingJob.objects.create(
        job_id=job_id,
        dataset_path=dataset_path,
        model_type=model_type or "",
        status="queued",
        result={"target_column": target} if target else {},
    )
    t = threading.Thread(target=_run_training, args=(job.job_id, dataset_path, model_type), daemon=True)
    t.start()
    return _cors(JsonResponse({"job_id": job.job_id}))


def train_status_view(request, job_id: str):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    try:
        job = TrainingJob.objects.get(job_id=job_id)
    except TrainingJob.DoesNotExist:
        return _cors(JsonResponse({"error": "job not found"}, status=404))

    data = {
        "job_id": job.job_id,
        "status": job.status,
        "dataset": job.dataset_path,
        "result": job.result,
        "error": job.error,
        "created_at": job.created_at,
    }
    return _cors(JsonResponse(data))


def models_list_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    artifacts = ModelArtifact.objects.all()
    models = [
        {
            "id": a.id,
            "name": a.name,
            "model_type": a.model_type,
            "path": a.path,
            "metrics": a.metrics,
            "is_active": a.is_active,
        }
        for a in artifacts
    ]
    return _cors(JsonResponse({"models": models}))


@csrf_exempt
def models_activate_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    if request.method != "POST":
        return _cors(JsonResponse({"error": "method not allowed"}, status=405))

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        payload = request.POST.dict()

    model_id = payload.get("id")
    if not model_id:
        return _cors(JsonResponse({"error": "id is required"}, status=400))

    try:
        model_id = int(model_id)
    except (TypeError, ValueError):
        return _cors(JsonResponse({"error": "id must be an integer"}, status=400))

    try:
        artifact = ModelArtifact.objects.get(id=model_id)
    except ModelArtifact.DoesNotExist:
        return _cors(JsonResponse({"error": "model not found"}, status=404))

    with transaction.atomic():
        ModelArtifact.objects.exclude(id=artifact.id).update(is_active=False)
        artifact.is_active = True
        artifact.save(update_fields=["is_active"])

    return _cors(JsonResponse({
        "ok": True,
        "active_model": {
            "id": artifact.id,
            "name": artifact.name,
            "model_type": artifact.model_type,
        },
    }))


def models_download_view(request):
    if request.method == "OPTIONS":
        return _cors(HttpResponse())
    model_id = request.GET.get("id")
    if not model_id:
        return _cors(JsonResponse({"error": "id query required"}, status=400))
    try:
        artifact = ModelArtifact.objects.get(id=int(model_id))
    except (ModelArtifact.DoesNotExist, ValueError):
        return _cors(JsonResponse({"error": "model not found"}, status=404))
    candidate = Path(artifact.path)
    if not candidate.exists():
        return _cors(JsonResponse({"error": "file not found on disk"}, status=404))
    resp = FileResponse(open(candidate, "rb"), as_attachment=True, filename=candidate.name)
    return _cors(resp)
