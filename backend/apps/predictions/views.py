from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from apps.auditlog.models import AuditLog
from apps.patients.models import Patient
from apps.perioperative.models import PerioperativeRecord
from .forms import PredictionInputForm
from .models import PredictionResult
from .services import run_prediction


@login_required
def prediction_create_view(request):
    prediction = None

    if request.method == "POST":
        form = PredictionInputForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data

            patient, _ = Patient.objects.update_or_create(
                hospital_id=data["hospital_id"],
                defaults={
                    "age": data["age"],
                    "sex": data["sex"],
                    "bmi": data["bmi"],
                    "smoking_history": data["smoking_history"],
                    "comorbidities": data["comorbidities"],
                    "baseline_spo2": data["baseline_spo2"],
                }
            )

            record = PerioperativeRecord.objects.create(
                patient=patient,
                surgery_type=data["surgery_type"],
                urgency=data["urgency"],
                surgery_duration=data["surgery_duration"],
                blood_loss=data["blood_loss"],
                ward=data["ward"],
                procedure_date=data["procedure_date"],
                anesthesia_type=data["anesthesia_type"],
                asa_class=data["asa_class"],
                residual_effects=data["residual_effects"],
                opioid_use=data["opioid_use"],
                airway_event=data["airway_event"],
                recovery_status=data["recovery_status"],
                postop_spo2=data["postop_spo2"],
                respiratory_rate=data["respiratory_rate"],
                pain_status=data["pain_status"],
                consciousness=data["consciousness"],
                time_since_surgery=data["time_since_surgery"],
                oxygen_before_prediction=data["oxygen_before_prediction"],
            )

            payload = {
                "age": patient.age,
                "sex": patient.sex,
                "bmi": patient.bmi,
                "smoking_history": patient.smoking_history,
                "comorbidities": patient.comorbidities,
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

            result = run_prediction(payload)

            prediction = PredictionResult.objects.create(
                record=record,
                predicted_probability=result["predicted_probability"],
                predicted_class=result["predicted_class"],
                risk_level=result["risk_level"],
                recommendations=result["recommendations"],
                contributing_factors=result["contributing_factors"],
            )

            AuditLog.objects.create(
                user=request.user,
                action="create_prediction",
                object_type="PredictionResult",
                object_id=str(prediction.id),
                details={
                    "patient_id": patient.hospital_id,
                    "risk_level": prediction.risk_level,
                    "probability": prediction.predicted_probability,
                },
            )
    else:
        form = PredictionInputForm()

    recent_predictions = PredictionResult.objects.select_related(
        "record", "record__patient"
    ).order_by("-generated_at")[:5]

    template = "predictions/prediction_result.html" if prediction else "predictions/prediction_form.html"
    return render(
        request,
        template,
        {"form": form, "prediction": prediction, "recent_predictions": recent_predictions},
    )
