from rest_framework.permissions import BasePermission


class SupportTicketPermission(BasePermission):
    def has_permission(self, request, view):
        if request.method == "POST":
            return True
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or request.user.is_superuser:
            return True
        if request.method in {"PATCH", "PUT", "DELETE"}:
            return False
        return obj.user_id == request.user.id
