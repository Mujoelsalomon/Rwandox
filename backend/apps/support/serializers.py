from rest_framework import serializers

from .models import SupportTicket


class SupportTicketSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            "id",
            "user",
            "full_name",
            "email",
            "role",
            "department",
            "category",
            "category_display",
            "priority",
            "priority_display",
            "subject",
            "message",
            "attachment",
            "status",
            "status_display",
            "admin_response",
            "email_delivery_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "category_display",
            "priority_display",
            "status_display",
            "email_delivery_error",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and not (user.is_staff or user.is_superuser):
            attrs.pop("status", None)
            attrs.pop("admin_response", None)
        return attrs
