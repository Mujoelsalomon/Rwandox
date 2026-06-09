from django.conf import settings
from django.db import models


class SupportTicket(models.Model):
    CATEGORY_TECHNICAL = "technical"
    CATEGORY_PREDICTION = "prediction"
    CATEGORY_TRAINING = "training"
    CATEGORY_LOGIN = "login"
    CATEGORY_UPLOAD = "upload"
    CATEGORY_SAFETY = "safety"
    CATEGORY_FEEDBACK = "feedback"

    CATEGORY_CHOICES = [
        (CATEGORY_TECHNICAL, "Technical Issue"),
        (CATEGORY_PREDICTION, "Prediction Concern"),
        (CATEGORY_TRAINING, "Model Training Issue"),
        (CATEGORY_LOGIN, "Login / Authentication Problem"),
        (CATEGORY_UPLOAD, "Data Upload Problem"),
        (CATEGORY_SAFETY, "Patient Safety Concern"),
        (CATEGORY_FEEDBACK, "General Feedback"),
    ]

    PRIORITY_LOW = "low"
    PRIORITY_MEDIUM = "medium"
    PRIORITY_HIGH = "high"
    PRIORITY_CRITICAL = "critical"

    PRIORITY_CHOICES = [
        (PRIORITY_LOW, "Low"),
        (PRIORITY_MEDIUM, "Medium"),
        (PRIORITY_HIGH, "High"),
        (PRIORITY_CRITICAL, "Critical"),
    ]

    STATUS_OPEN = "open"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_RESOLVED = "resolved"
    STATUS_CLOSED = "closed"

    STATUS_CHOICES = [
        (STATUS_OPEN, "Open"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_RESOLVED, "Resolved"),
        (STATUS_CLOSED, "Closed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="support_tickets",
    )
    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    role = models.CharField(max_length=100, blank=True)
    department = models.CharField(max_length=100, blank=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default=PRIORITY_MEDIUM)
    subject = models.CharField(max_length=200)
    message = models.TextField()
    attachment = models.FileField(upload_to="support_attachments/", blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN)
    admin_response = models.TextField(blank=True)
    email_delivery_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"#{self.pk} {self.subject}"
