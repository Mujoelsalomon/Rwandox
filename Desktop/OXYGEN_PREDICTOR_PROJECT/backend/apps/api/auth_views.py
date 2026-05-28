from django.contrib.auth import authenticate, login, logout
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .common import cors, json_body, require_login
from .serializers import user_payload


DEFAULT_USERNAME = "anesthetist"
DEFAULT_EMAIL = "munyanezajoel3@gmail.com"
DEFAULT_PASSWORD = "Munyaneza@123"
FAST_LOGIN_PBKDF2_ITERATIONS = int(getattr(settings, "FAST_LOGIN_PBKDF2_ITERATIONS", 120000))


def ensure_default_user(identifier=None):
    normalized_identifier = str(identifier or "").strip().lower()
    if normalized_identifier not in {DEFAULT_USERNAME, DEFAULT_EMAIL}:
        return None

    existing_user = User.objects.filter(username=DEFAULT_USERNAME).only("id", "password").first()
    if existing_user:
        if should_refresh_default_password(existing_user.password):
            existing_user.set_password(DEFAULT_PASSWORD)
            existing_user.email = DEFAULT_EMAIL
            existing_user.first_name = "Anesthetist"
            existing_user.is_staff = True
            existing_user.is_superuser = True
            existing_user.save(update_fields=["password", "email", "first_name", "is_staff", "is_superuser"])
        return existing_user

    return User.objects.create_superuser(
        username=DEFAULT_USERNAME,
        email=DEFAULT_EMAIL,
        password=DEFAULT_PASSWORD,
        first_name="Anesthetist",
    )


def should_refresh_default_password(encoded_password):
    try:
        algorithm, iterations, *_ = str(encoded_password).split("$")
        configured_hasher = settings.PASSWORD_HASHERS[0]
        return (
            algorithm == "pbkdf2_sha256"
            and int(iterations) > FAST_LOGIN_PBKDF2_ITERATIONS
            and "FastLoginPBKDF2PasswordHasher" in configured_hasher
        )
    except (TypeError, ValueError):
        return False


@csrf_exempt
def login_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    identifier = str(payload.get("username") or payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    ensure_default_user(identifier)
    username = identifier
    if "@" in identifier:
        user_by_email = User.objects.filter(email__iexact=identifier).only("username").first()
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


@csrf_exempt
def profile_update_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method not in {"POST", "PATCH"}:
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    full_name = str(payload.get("name") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    role = str(payload.get("role") or "").strip()
    target_user = request.user
    target_user_id = payload.get("user_id") or payload.get("id")

    try:
        target_user_id = int(target_user_id) if target_user_id else request.user.id
    except (TypeError, ValueError):
        return cors(JsonResponse({"error": "Invalid user profile id."}, status=400))

    if target_user_id != request.user.id:
        if not (request.user.is_staff or request.user.is_superuser):
            return cors(JsonResponse({"error": "Only an administrator can edit another user profile."}, status=403))
        target_user = User.objects.filter(id=target_user_id).first()
        if target_user is None:
            return cors(JsonResponse({"error": "User profile not found."}, status=404))

    if not full_name or not email:
        return cors(JsonResponse({"error": "Name and email are required."}, status=400))
    if role and not (request.user.is_staff or request.user.is_superuser):
        return cors(JsonResponse({"error": "Only an administrator can edit user roles."}, status=403))
    if role == "Superuser" and not request.user.is_superuser:
        return cors(JsonResponse({"error": "Only a superuser can assign the superuser role."}, status=403))
    if target_user.is_superuser and target_user.id != request.user.id and not request.user.is_superuser:
        return cors(JsonResponse({"error": "Only a superuser can edit a superuser profile."}, status=403))

    duplicate = User.objects.filter(email__iexact=email).exclude(id=target_user.id).exists()
    if duplicate:
        return cors(JsonResponse({"error": "Another account already uses this email."}, status=409))

    name_parts = full_name.split(maxsplit=1)
    target_user.first_name = name_parts[0]
    target_user.last_name = name_parts[1] if len(name_parts) > 1 else ""
    target_user.email = email
    update_fields = ["first_name", "last_name", "email"]
    if role:
        target_user.is_staff = role in {"Administrator", "Superuser"}
        target_user.is_superuser = role == "Superuser"
        update_fields.extend(["is_staff", "is_superuser"])
    target_user.save(update_fields=update_fields)
    return cors(JsonResponse({"user": user_payload(target_user)}))
