from apps.auditlog.models import AuditLog


def record_audit(request, action, object_type="", object_id="", details=None):
    user = getattr(request, "user", None)
    if not getattr(user, "is_authenticated", False):
        user = None
    try:
        AuditLog.objects.create(
            user=user,
            action=str(action)[:100],
            object_type=str(object_type or "")[:100],
            object_id=str(object_id or "")[:100],
            details=details or {},
        )
    except Exception:
        pass


def audit_payload(log):
    user = log.user
    return {
        "id": log.id,
        "name": user.get_full_name() or user.username if user else "System",
        "userId": f"USR-{user.id:03d}" if user else "SYSTEM",
        "username": user.username if user else "",
        "email": user.email if user else "",
        "time": log.timestamp.isoformat() if log.timestamp else None,
        "action": log.action,
        "object_type": log.object_type,
        "object_id": log.object_id,
        "details": log.details or {},
    }
