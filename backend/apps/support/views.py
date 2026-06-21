from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.api.audit import record_audit

from .authentication import SessionOrDevelopmentHeaderAuthentication
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
        if not user.is_authenticated:
            return queryset.none()
        if user.is_staff or user.is_superuser:
            return queryset
        return queryset.filter(user=user)

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        ticket = serializer.save(user=user)
        record_audit(
            self.request,
            "Created support ticket",
            object_type="SupportTicket",
            object_id=ticket.id,
            details={"category": ticket.category, "priority": ticket.priority},
        )

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

    @action(detail=True, methods=["post", "patch"], url_path="resolve")
    def resolve(self, request, pk=None):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Only administrators can resolve support tickets."}, status=status.HTTP_403_FORBIDDEN)

        ticket = self.get_object()
        admin_response = request.data.get("admin_response")
        if admin_response is not None:
            ticket.admin_response = str(admin_response).strip()
        if not ticket.admin_response:
            ticket.admin_response = "Resolved by administrator."
        ticket.status = SupportTicket.STATUS_RESOLVED
        ticket.save(update_fields=["status", "admin_response", "updated_at"])
        record_audit(
            request,
            "Resolved support ticket",
            object_type="SupportTicket",
            object_id=ticket.id,
            details={"status": ticket.status},
        )
        return Response(self.get_serializer(ticket).data)
