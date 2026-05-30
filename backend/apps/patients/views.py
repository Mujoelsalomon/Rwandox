from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, render

from .models import Patient


@login_required
def patient_list_view(request):
    query = request.GET.get("q", "")
    patients = Patient.objects.all()
    if query:
        patients = patients.filter(hospital_id__icontains=query)
    return render(request, "patients/list.html", {"patients": patients, "query": query})


@login_required
def patient_detail_view(request, pk):
    patient = get_object_or_404(Patient, pk=pk)
    records = patient.perioperative_records.select_related("prediction").all()
    return render(request, "patients/detail.html", {"patient": patient, "records": records})
