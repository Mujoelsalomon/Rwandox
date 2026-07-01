from django.db import models
from apps.perioperative.models import PerioperativeRecord


class PredictionResult(models.Model):
    record = models.OneToOneField(
        PerioperativeRecord,
        on_delete=models.CASCADE,
        related_name="prediction"
    )
    raw_probability = models.FloatField(null=True, blank=True)
    calibrated_probability = models.FloatField(null=True, blank=True)
    display_probability = models.CharField(max_length=12, blank=True, default="")
    predicted_probability = models.FloatField()
    predicted_class = models.CharField(max_length=20)
    risk_level = models.CharField(max_length=20)
    selected_threshold = models.FloatField(null=True, blank=True)
    model_name = models.CharField(max_length=200, blank=True, default="")
    recommendations = models.JSONField(default=list, blank=True)
    contributing_factors = models.JSONField(default=list, blank=True)
    model_version = models.CharField(max_length=50, default="Not recorded")
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-generated_at"]

    def __str__(self):
        return f"{self.record.patient.hospital_id} - {self.risk_level}"
