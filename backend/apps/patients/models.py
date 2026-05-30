from django.db import models


class Patient(models.Model):
    hospital_id = models.CharField(max_length=50, unique=True)
    age = models.PositiveIntegerField()
    sex = models.CharField(max_length=10)
    bmi = models.FloatField(null=True, blank=True)
    smoking_history = models.BooleanField(default=False)
    comorbidities = models.TextField(blank=True)
    baseline_spo2 = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.hospital_id
