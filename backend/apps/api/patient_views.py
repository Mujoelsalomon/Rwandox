from django.http import HttpResponse, JsonResponse

from apps.patients.models import Patient

from .common import cors, require_login
from .serializers import patient_payload


def patients_list_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error

    patients = [
        patient_payload(patient)
        for patient in Patient.objects.prefetch_related("perioperative_records__prediction").all()[:250]
    ]
    return cors(JsonResponse({"patients": patients}))


def patients_search_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error

    query = request.GET.get("q", "").strip()
    qs = Patient.objects.prefetch_related("perioperative_records__prediction").all()
    if query:
        qs = qs.filter(hospital_id__icontains=query)

    patients = [patient_payload(patient) for patient in qs[:10]]

    return cors(JsonResponse({"patients": patients}))
