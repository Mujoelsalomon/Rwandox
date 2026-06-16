from django.db import models
from apps.perioperative.models import PerioperativeRecord


class PredictionResult(models.Model):
    record = models.OneToOneField(
        PerioperativeRecord,
        on_delete=models.CASCADE,
        related_name="prediction"
    )
    predicted_probability = models.FloatField()
    predicted_class = models.CharField(max_length=20)
    risk_level = models.CharField(max_length=20)
    recommendations = models.JSONField(default=list, blank=True)
    contributing_factors = models.JSONField(default=list, blank=True)
    model_version = models.CharField(max_length=50, default="Not recorded")
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-generated_at"]

    def __str__(self):
        return f"{self.record.patient.hospital_id} - {self.risk_level}"
