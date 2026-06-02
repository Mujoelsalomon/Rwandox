import json

from django.conf import settings
from django.contrib.auth.models import User
from django.http import JsonResponse


def cors(resp):
    allowed_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
    fallback_origin = getattr(settings, "FRONTEND_ORIGIN", "http://localhost:5173")
    request_origin = getattr(resp, "wsgi_request", None)
    origin = fallback_origin
    if request_origin:
        request_origin = request_origin.headers.get("Origin")
        if request_origin in allowed_origins:
            origin = request_origin
    resp["Access-Control-Allow-Origin"] = origin
    resp["Access-Control-Allow-Credentials"] = "true"
    resp["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-User-Email, X-CSRFToken"
    return resp


def json_body(request):
    try:
        return json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        return request.POST.dict()


def require_login(request):
    if not request.user.is_authenticated:
        fallback_user = development_header_user(request)
        if fallback_user is not None:
            request.user = fallback_user
            return None
        return cors(JsonResponse({"error": "Authentication required."}, status=401))
    return None


def development_header_user(request):
    if not getattr(settings, "DEBUG", False):
        return None

    email = str(request.headers.get("X-User-Email") or "").strip().lower()
    if not email:
        return None

    return User.objects.filter(email__iexact=email, is_active=True).first()


def require_admin(request):
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if not (request.user.is_staff or request.user.is_superuser):
        return cors(JsonResponse({"error": "Administrator or superuser access required."}, status=403))
    return None


def bool_value(value):
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"true", "1", "yes", "y"}


def float_value(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def int_value(value, default):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def int_or_none(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None
