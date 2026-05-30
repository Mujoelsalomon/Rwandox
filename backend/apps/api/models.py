from django.db import models


class TrainingJob(models.Model):
    JOB_STATUS = [
        ("queued", "Queued"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    job_id = models.CharField(max_length=64, unique=True)
    dataset_path = models.TextField()
    model_type = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=20, choices=JOB_STATUS, default="queued")
    result = models.JSONField(null=True, blank=True)
    error = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.job_id} - {self.status}"


class ModelArtifact(models.Model):
    name = models.CharField(max_length=200)
    path = models.TextField()
    model_type = models.CharField(max_length=50, blank=True, null=True)
    metrics = models.JSONField(null=True, blank=True)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class Ward(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class SurgeryType(models.Model):
    name = models.CharField(max_length=150, unique=True)
    category = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class AnesthesiaType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class ModelRegistry(models.Model):
    model_name = models.CharField(max_length=100)
    version = models.CharField(max_length=50)
    algorithm = models.CharField(max_length=100)
    auc = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    sensitivity = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    specificity = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    precision_score = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    recall_score = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    f1_score = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("model_name", "version")

    def __str__(self):
        return f"{self.model_name} ({self.version})"


class EmrSyncLog(models.Model):
    perioperative_record_id = models.BigIntegerField(null=True, blank=True)
    sync_status = models.CharField(max_length=30)
    external_reference = models.CharField(max_length=150, blank=True)
    message = models.TextField(blank=True)
    synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"EMR Sync {self.id} - {self.sync_status}"


class SystemSetting(models.Model):
    setting_key = models.CharField(max_length=100, unique=True)
    setting_value = models.TextField()
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.setting_key
