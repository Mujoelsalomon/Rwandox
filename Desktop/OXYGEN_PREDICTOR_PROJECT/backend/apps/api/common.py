import json

from django.conf import settings
from django.http import JsonResponse


def cors(resp):
    origin = getattr(settings, "FRONTEND_ORIGIN", "http://localhost:5173")
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
        return cors(JsonResponse({"error": "Authentication required."}, status=401))
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
