from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .common import cors, json_body, require_login
from .serializers import user_payload


DEFAULT_USERNAME = "anesthetist"
DEFAULT_EMAIL = "munyanezajoel3@gmail.com"
DEFAULT_PASSWORD = "Munyaneza@123"


def ensure_default_user():
    user, created = User.objects.get_or_create(
        username=DEFAULT_USERNAME,
        defaults={
            "email": DEFAULT_EMAIL,
            "first_name": "Anesthetist",
            "is_staff": True,
            "is_superuser": True,
        },
    )
    if created or not user.check_password(DEFAULT_PASSWORD):
        user.set_password(DEFAULT_PASSWORD)
        user.email = DEFAULT_EMAIL
        user.first_name = "Anesthetist"
        user.is_staff = True
        user.is_superuser = True
        user.save()
    return user


@csrf_exempt
def login_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    identifier = str(payload.get("username") or payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    ensure_default_user()
    username = identifier
    if "@" in identifier:
        user_by_email = User.objects.filter(email__iexact=identifier).first()
        username = user_by_email.username if user_by_email else identifier

    user = authenticate(request, username=username, password=password)
    if user is None:
        return cors(JsonResponse({"error": "Invalid username/email or password."}, status=401))

    login(request, user)
    return cors(JsonResponse({"user": user_payload(user)}))


@csrf_exempt
def register_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    full_name = str(payload.get("name") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not full_name or not email or not password:
        return cors(JsonResponse({"error": "Name, email, and password are required."}, status=400))
    if User.objects.filter(email__iexact=email).exists():
        return cors(JsonResponse({"error": "An account with this email already exists."}, status=409))

    base_username = email.split("@")[0] or "user"
    username = base_username
    suffix = 1
    while User.objects.filter(username__iexact=username).exists():
        suffix += 1
        username = f"{base_username}{suffix}"

    user = User.objects.create_user(username=username, email=email, password=password)
    name_parts = full_name.split(maxsplit=1)
    user.first_name = name_parts[0]
    user.last_name = name_parts[1] if len(name_parts) > 1 else ""
    user.save(update_fields=["first_name", "last_name"])
    return cors(JsonResponse({"user": user_payload(user)}, status=201))


@csrf_exempt
def logout_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    logout(request)
    return cors(JsonResponse({"ok": True}))


@csrf_exempt
def logout_all_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    Session.objects.all().delete()
    logout(request)
    return cors(JsonResponse({"ok": True}))


def current_user_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    if not request.user.is_authenticated:
        return cors(JsonResponse({"authenticated": False}, status=401))
    return cors(JsonResponse({"authenticated": True, "user": user_payload(request.user)}))
