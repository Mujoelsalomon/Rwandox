from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.patients.models import Patient
from apps.predictions.models import PredictionResult

from .common import cors, require_login


FHIR_VERSION = "4.0.1"
SYSTEM_URL = "https://rwandoxy.com/fhir"


def fhir_capability_statement_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "GET":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    return fhir_json({
        "resourceType": "CapabilityStatement",
        "status": "active",
        "date": "2026-06-06",
        "kind": "instance",
        "fhirVersion": FHIR_VERSION,
        "format": ["json"],
        "software": {
            "name": "A Machine Learning Model for Predicting Postoperative Oxygen Requirement Among Surgical Patients in Rwanda",
            "version": "1.0",
        },
        "implementation": {
            "description": "FHIR adapter for OpenMRS, OpenClinic, and hospital interoperability.",
            "url": SYSTEM_URL,
        },
        "rest": [{
            "mode": "server",
            "resource": [
                {"type": "Patient", "interaction": [{"code": "read"}, {"code": "search-type"}]},
                {"type": "Observation", "interaction": [{"code": "search-type"}]},
                {"type": "RiskAssessment", "interaction": [{"code": "read"}, {"code": "search-type"}]},
            ],
        }],
    })


@csrf_exempt
def fhir_patient_view(request, patient_id=None):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "GET":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    if patient_id:
        patient = find_patient(patient_id)
        if patient is None:
            return fhir_json(operation_outcome("Patient not found."), status=404)
        return fhir_json(patient_resource(patient))

    query = str(request.GET.get("identifier") or request.GET.get("q") or "").strip()
    patients = Patient.objects.all()
    if query:
        patients = patients.filter(hospital_id__icontains=query)
    entries = [bundle_entry(patient_resource(patient)) for patient in patients[:50]]
    return fhir_json(search_bundle(entries))


@csrf_exempt
def fhir_observation_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "GET":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    patient = patient_from_query(request)
    if patient is None:
        return fhir_json(operation_outcome("Patient query parameter is required or patient was not found."), status=400)

    entries = []
    latest_record = patient.perioperative_records.first()
    for observation in patient_observations(patient, latest_record):
        entries.append(bundle_entry(observation))
    return fhir_json(search_bundle(entries))


@csrf_exempt
def fhir_risk_assessment_view(request, prediction_id=None):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "GET":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    if prediction_id:
        prediction = PredictionResult.objects.select_related("record", "record__patient").filter(id=prediction_id).first()
        if prediction is None:
            return fhir_json(operation_outcome("RiskAssessment not found."), status=404)
        return fhir_json(risk_assessment_resource(prediction))

    predictions = PredictionResult.objects.select_related("record", "record__patient").all()
    patient = patient_from_query(request)
    if patient is not None:
        predictions = predictions.filter(record__patient=patient)
    entries = [bundle_entry(risk_assessment_resource(prediction)) for prediction in predictions[:100]]
    return fhir_json(search_bundle(entries))


def fhir_json(payload, status=200):
    response = JsonResponse(payload, status=status, json_dumps_params={"indent": 2})
    response["Content-Type"] = "application/fhir+json"
    return cors(response)


def find_patient(identifier):
    identifier = str(identifier or "").strip()
    if not identifier:
        return None
    if identifier.isdigit():
        patient = Patient.objects.filter(id=int(identifier)).first()
        if patient:
            return patient
    return Patient.objects.filter(hospital_id__iexact=identifier).first()


def patient_from_query(request):
    raw = request.GET.get("patient") or request.GET.get("subject") or request.GET.get("identifier")
    if not raw:
        return None
    patient_id = str(raw).replace("Patient/", "").strip()
    return find_patient(patient_id)


def patient_resource(patient):
    gender = str(patient.sex or "unknown").lower()
    if gender not in {"male", "female", "other", "unknown"}:
        gender = "unknown"

    return {
        "resourceType": "Patient",
        "id": patient.hospital_id,
        "identifier": [{
            "system": "https://openmrs.org/id/patient-identifier",
            "value": patient.hospital_id,
        }],
        "name": [{"text": f"Patient {patient.hospital_id}"}],
        "gender": gender,
        "extension": [{
            "url": f"{SYSTEM_URL}/StructureDefinition/age-years",
            "valueInteger": patient.age,
        }],
    }


def patient_observations(patient, record):
    observations = []
    if patient.baseline_spo2 is not None:
        observations.append(observation_resource(
            patient=patient,
            code="59408-5",
            display="Oxygen saturation in Arterial blood by Pulse oximetry",
            value=patient.baseline_spo2,
            unit="%",
            category="vital-signs",
            identifier="baseline-spo2",
        ))
    if patient.bmi is not None:
        observations.append(observation_resource(
            patient=patient,
            code="39156-5",
            display="Body mass index (BMI) [Ratio]",
            value=patient.bmi,
            unit="kg/m2",
            category="exam",
            identifier="bmi",
        ))
    if record and record.postop_spo2 is not None:
        observations.append(observation_resource(
            patient=patient,
            code="59408-5",
            display="Postoperative oxygen saturation by pulse oximetry",
            value=record.postop_spo2,
            unit="%",
            category="vital-signs",
            identifier=f"postop-spo2-{record.id}",
            issued=record.created_at.isoformat(),
        ))
    if record and record.respiratory_rate is not None:
        observations.append(observation_resource(
            patient=patient,
            code="9279-1",
            display="Respiratory rate",
            value=record.respiratory_rate,
            unit="/min",
            category="vital-signs",
            identifier=f"respiratory-rate-{record.id}",
            issued=record.created_at.isoformat(),
        ))
    return observations


def observation_resource(patient, code, display, value, unit, category, identifier, issued=None):
    payload = {
        "resourceType": "Observation",
        "id": f"{patient.hospital_id}-{identifier}",
        "status": "final",
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": category,
            }],
        }],
        "code": {
            "coding": [{
                "system": "http://loinc.org",
                "code": code,
                "display": display,
            }],
            "text": display,
        },
        "subject": {"reference": f"Patient/{patient.hospital_id}"},
        "valueQuantity": {
            "value": value,
            "unit": unit,
            "system": "http://unitsofmeasure.org",
            "code": unit,
        },
    }
    if issued:
        payload["issued"] = issued
    return payload


def risk_assessment_resource(prediction):
    patient = prediction.record.patient
    probability = float(prediction.predicted_probability or 0)
    if probability > 1:
        probability = probability / 100

    return {
        "resourceType": "RiskAssessment",
        "id": str(prediction.id),
        "status": "final",
        "method": {
            "text": prediction.model_version or "Postoperative oxygen prediction model",
        },
        "subject": {"reference": f"Patient/{patient.hospital_id}"},
        "occurrenceDateTime": prediction.generated_at.isoformat(),
        "basis": [{"reference": f"Patient/{patient.hospital_id}"}],
        "prediction": [{
            "outcome": {
                "coding": [{
                    "system": f"{SYSTEM_URL}/CodeSystem/postoperative-oxygen-risk",
                    "code": str(prediction.risk_level or "unknown").lower(),
                    "display": prediction.risk_level or "Unknown",
                }],
                "text": f"{prediction.risk_level} postoperative oxygen requirement risk",
            },
            "probabilityDecimal": round(probability, 4),
            "rationale": factor_text(prediction.contributing_factors),
        }],
        "note": [{"text": recommendation_text(prediction.recommendations)}],
    }


def factor_text(factors):
    if not isinstance(factors, list) or not factors:
        return "No contributing factors recorded."
    labels = []
    for factor in factors:
        if isinstance(factor, str):
            labels.append(factor)
        elif isinstance(factor, dict):
            labels.append(str(factor.get("display") or factor.get("label") or factor.get("feature") or "Recorded factor"))
    return "; ".join(labels) if labels else "No contributing factors recorded."


def recommendation_text(recommendations):
    if isinstance(recommendations, list) and recommendations:
        return " ".join(str(item) for item in recommendations if item)
    return "Use clinical judgment and local postoperative monitoring protocol."


def search_bundle(entries):
    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(entries),
        "entry": entries,
    }


def bundle_entry(resource):
    return {
        "fullUrl": f"{SYSTEM_URL}/{resource['resourceType']}/{resource.get('id', '')}",
        "resource": resource,
    }


def operation_outcome(message):
    return {
        "resourceType": "OperationOutcome",
        "issue": [{
            "severity": "error",
            "code": "not-found",
            "diagnostics": message,
        }],
    }
