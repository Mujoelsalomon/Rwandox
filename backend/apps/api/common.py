import json
import re

from django.conf import settings
from django.contrib.auth.models import User
from django.http import JsonResponse


def cors(resp):
    allowed_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
    allowed_origin_regexes = getattr(settings, "CORS_ALLOWED_ORIGIN_REGEXES", [])
    fallback_origin = getattr(settings, "FRONTEND_ORIGIN", "http://localhost:5173")
    request_origin = getattr(resp, "wsgi_request", None)
    origin = fallback_origin
    if request_origin:
        request_origin = request_origin.headers.get("Origin")
        if request_origin in allowed_origins or origin_matches_any(request_origin, allowed_origin_regexes):
            origin = request_origin
    resp["Access-Control-Allow-Origin"] = origin
    resp["Access-Control-Allow-Credentials"] = "true"
    resp["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-User-Email, X-User-Username, X-CSRFToken"
    return resp


def origin_matches_any(origin, patterns):
    if not origin:
        return False
    return any(re.match(pattern, origin) for pattern in patterns)


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
    """Allow the local preview frontend to authenticate with its saved session.

    The React app stores a local session token and user email after login. In
    DEBUG mode we accept that email/username header as a local-development
    fallback when the browser does not send Django's session cookie, which can
    happen when switching between localhost and LAN IP URLs.
    """
    if not getattr(settings, "DEBUG", False):
        return None

    identifier = str(
        request.headers.get("X-User-Email")
        or request.headers.get("X-User-Username")
        or ""
    ).strip().lower()
    if not identifier:
        return None

    query = User.objects.filter(is_active=True)
    if "@" in identifier:
        return query.filter(email__iexact=identifier).first()
    return query.filter(username__iexact=identifier).first()


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
