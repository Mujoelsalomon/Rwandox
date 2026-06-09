import csv
import io

from django.http import HttpResponse, JsonResponse
from django.utils import timezone

from apps.auditlog.models import AuditLog

from .audit import audit_payload, record_audit
from .common import cors, require_admin


def audit_logs_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "GET":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    limit = min(max(int_value(request.GET.get("limit"), 100), 1), 500)
    logs = AuditLog.objects.select_related("user").all()[:limit]
    record_audit(request, "Viewed audit logs", object_type="AuditLog", details={"limit": limit})
    return cors(JsonResponse({"logs": [audit_payload(log) for log in logs]}))


def audit_logs_export_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "GET":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    logs = AuditLog.objects.select_related("user").all()[:500]
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "User ID", "Username", "Email", "Time", "Action", "Object Type", "Object ID"])
    for log in logs:
        payload = audit_payload(log)
        writer.writerow([
            payload["name"],
            payload["userId"],
            payload["username"],
            payload["email"],
            payload["time"],
            payload["action"],
            payload["object_type"],
            payload["object_id"],
        ])

    record_audit(request, "Exported audit logs", object_type="AuditLog")
    response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="audit-logs-{timezone.now().strftime("%Y%m%d%H%M%S")}.csv"'
    return cors(response)


def int_value(value, default):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
