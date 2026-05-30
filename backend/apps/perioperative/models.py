from django.db import models
from apps.patients.models import Patient


class PerioperativeRecord(models.Model):
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="perioperative_records"
    )

    surgery_type = models.CharField(max_length=100)
    urgency = models.CharField(
        max_length=20,
        choices=[("elective", "Elective"), ("emergency", "Emergency")]
    )
    surgery_duration = models.PositiveIntegerField(help_text="Duration in minutes")
    blood_loss = models.CharField(max_length=50, blank=True)
    ward = models.CharField(max_length=50, blank=True)
    procedure_date = models.DateField(null=True, blank=True)

    anesthesia_type = models.CharField(max_length=50)
    asa_class = models.CharField(max_length=10, blank=True)
    residual_effects = models.BooleanField(default=False)
    opioid_use = models.BooleanField(default=False)
    airway_event = models.CharField(max_length=100, blank=True)
    recovery_status = models.CharField(max_length=50, blank=True)

    postop_spo2 = models.FloatField(null=True, blank=True)
    respiratory_rate = models.PositiveIntegerField(null=True, blank=True)
    pain_status = models.CharField(max_length=50, blank=True)
    consciousness = models.CharField(max_length=50, blank=True)
    time_since_surgery = models.PositiveIntegerField(null=True, blank=True)
    oxygen_before_prediction = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.patient.hospital_id} - {self.surgery_type}"
