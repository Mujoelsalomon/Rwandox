from rest_framework import viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.api.audit import record_audit

from .authentication import SessionOrDevelopmentHeaderAuthentication
from .email import send_support_ticket_email
from .models import SupportTicket
from .permissions import SupportTicketPermission
from .serializers import SupportTicketSerializer


class SupportTicketViewSet(viewsets.ModelViewSet):
    serializer_class = SupportTicketSerializer
    permission_classes = [SupportTicketPermission]
    authentication_classes = [SessionOrDevelopmentHeaderAuthentication]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = SupportTicket.objects.select_related("user").all()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return queryset
        return queryset.filter(user=user)

    def perform_create(self, serializer):
        ticket = serializer.save(user=self.request.user)
        record_audit(
            self.request,
            "Created support ticket",
            object_type="SupportTicket",
            object_id=ticket.id,
            details={"category": ticket.category, "priority": ticket.priority},
        )
        try:
            send_support_ticket_email(ticket)
        except Exception as exc:
            ticket.email_delivery_error = str(exc)
            ticket.save(update_fields=["email_delivery_error", "updated_at"])

    def partial_update(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            mutable_data = request.data.copy()
            mutable_data.pop("status", None)
            mutable_data.pop("admin_response", None)
            request._full_data = mutable_data
        response = super().partial_update(request, *args, **kwargs)
        record_audit(request, "Updated support ticket", object_type="SupportTicket", object_id=kwargs.get("pk", ""))
        return response

    def update(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Only administrators can update support tickets."}, status=403)
        response = super().update(request, *args, **kwargs)
        record_audit(request, "Updated support ticket", object_type="SupportTicket", object_id=kwargs.get("pk", ""))
        return response
