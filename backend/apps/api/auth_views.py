import os

from django.contrib.auth import authenticate, login, logout
from django.conf import settings
from django.contrib.auth.models import Group, User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.contrib.sessions.models import Session
from django.http import HttpResponse, JsonResponse
from django.utils.crypto import get_random_string

from .audit import record_audit
from .common import cors, csrf_exempt_trusted as csrf_exempt, json_body, require_login
from .serializers import CLINICAL_ROLE_NAMES, user_payload
from .models import SystemSetting
from .hospitals import HOSPITALS_BY_ID
import json as _json
from django.utils import timezone
from apps.accounts.models import UserProfile, ensure_user_profile
from .common import require_admin


DEFAULT_USERNAME = "anesthetist"
DEFAULT_EMAIL = os.getenv("DEFAULT_ADMIN_EMAIL") or ""
DEFAULT_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD") or ""
BOOTSTRAP_DEFAULT_ADMIN = str(
    os.getenv("BOOTSTRAP_DEFAULT_ADMIN", "0")
).strip().lower() in {"1", "true", "yes", "on"}
FAST_LOGIN_PBKDF2_ITERATIONS = int(getattr(settings, "FAST_LOGIN_PBKDF2_ITERATIONS", 120000))
VALID_PROFILE_ROLES = {*CLINICAL_ROLE_NAMES, "Administrator", "Superuser"}


def ensure_default_user(identifier=None):
    if not BOOTSTRAP_DEFAULT_ADMIN or not DEFAULT_EMAIL or not DEFAULT_PASSWORD:
        return None

    normalized_identifier = str(identifier or "").strip().lower()
    if normalized_identifier not in {DEFAULT_USERNAME, DEFAULT_EMAIL}:
        return None

    existing_user = User.objects.filter(username=DEFAULT_USERNAME).only("id", "password").first()
    if existing_user:
        update_fields = []
        if should_refresh_default_password(existing_user.password) or not existing_user.check_password(DEFAULT_PASSWORD):
            existing_user.set_password(DEFAULT_PASSWORD)
            update_fields.append("password")
        if existing_user.email != DEFAULT_EMAIL:
            existing_user.email = DEFAULT_EMAIL
            update_fields.append("email")
        if existing_user.first_name != "Anesthetist":
            existing_user.first_name = "Anesthetist"
            update_fields.append("first_name")
        if not existing_user.is_staff:
            existing_user.is_staff = True
            update_fields.append("is_staff")
        if not existing_user.is_superuser:
            existing_user.is_superuser = True
            update_fields.append("is_superuser")
        if not existing_user.is_active:
            existing_user.is_active = True
            update_fields.append("is_active")
        if update_fields:
            existing_user.save(update_fields=update_fields)
        profile = ensure_user_profile(existing_user)
        if profile.must_change_password:
            profile.must_change_password = False
            profile.save(update_fields=["must_change_password", "updated_at"])
        return existing_user

    user = User.objects.create_superuser(
        username=DEFAULT_USERNAME,
        email=DEFAULT_EMAIL,
        password=DEFAULT_PASSWORD,
        first_name="Anesthetist",
    )
    profile = ensure_user_profile(user)
    if profile.must_change_password:
        profile.must_change_password = False
        profile.save(update_fields=["must_change_password", "updated_at"])
    return user


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


def sync_user_role_group(user, role):
    clinical_groups = Group.objects.filter(name__in=CLINICAL_ROLE_NAMES)
    if clinical_groups.exists():
        user.groups.remove(*clinical_groups)
    if role in CLINICAL_ROLE_NAMES:
        group, _created = Group.objects.get_or_create(name=role)
        user.groups.add(group)


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
    username = login_username_for_identifier(identifier)

    user = authenticate(request, username=username, password=password)
    if user is None:
        inactive_user = User.objects.filter(username__iexact=username, is_active=False).first()
        if inactive_user and inactive_user.check_password(password):
            return cors(JsonResponse({"error": "This account is disabled. Contact Model Administration."}, status=403))
        return cors(JsonResponse({"error": "Invalid username/email or password."}, status=401))

    login(request, user)
    record_audit(request, "Logged in", object_type="User", object_id=user.id)
    return cors(JsonResponse({"user": user_payload(user)}))


def login_username_for_identifier(identifier):
    if "@" in identifier:
        user_by_email = User.objects.filter(email__iexact=identifier).only("username").first()
        return user_by_email.username if user_by_email else identifier

    profile = UserProfile.objects.select_related("user").filter(user_code__iexact=identifier).first()
    if profile:
        return profile.user.username

    return identifier


@csrf_exempt
def register_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))
    admin_error = require_admin(request)
    if admin_error:
        return admin_error

    payload = json_body(request)
    full_name = str(payload.get("name") or "").strip()
    requested_username = str(payload.get("username") or "").strip().lower()
    email = str(payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    role = str(payload.get("role") or "").strip()

    if not full_name or not email:
        return cors(JsonResponse({"error": "Name and email are required."}, status=400))

    # Allow admin to omit password: generate a temporary password and return it.
    requested_password = password or ""
    if requested_password:
        password_error = validate_password_response(requested_password)
        if password_error:
            return password_error
    else:
        requested_password = get_random_string(14)
    if role:
        if role not in VALID_PROFILE_ROLES:
            return cors(JsonResponse({"error": "Invalid user role."}, status=400))
        if role == "Superuser" and not request.user.is_superuser:
            return cors(JsonResponse({"error": "Only a superuser can assign the superuser role."}, status=403))
    if User.objects.filter(email__iexact=email).exists():
        return cors(JsonResponse({"error": "An account with this email already exists."}, status=409))
    if requested_username and User.objects.filter(username__iexact=requested_username).exists():
        return cors(JsonResponse({"error": "An account with this username already exists."}, status=409))

    base_username = email.split("@")[0] or "user"
    username = requested_username or base_username
    suffix = 1
    while User.objects.filter(username__iexact=username).exists():
        suffix += 1
        username = f"{base_username}{suffix}"

    user = User.objects.create_user(username=username, email=email, password=requested_password)
    name_parts = full_name.split(maxsplit=1)
    user.first_name = name_parts[0]
    user.last_name = name_parts[1] if len(name_parts) > 1 else ""
    update_fields = ["first_name", "last_name"]
    # Admin-created users should be active immediately.
    user.is_active = True
    update_fields.append("is_active")
    if role:
        user.is_staff = role in {"Administrator", "Superuser"}
        user.is_superuser = role == "Superuser"
        update_fields.extend(["is_staff", "is_superuser"])
    user.save(update_fields=update_fields)
    profile = ensure_user_profile(user)
    profile.must_change_password = True
    profile.save(update_fields=["must_change_password", "updated_at"])
    sync_user_role_group(user, role or "Doctor")
    record_audit(request, "Registered user account", object_type="User", object_id=user.id)
    return cors(JsonResponse({"user": user_payload(user), "temporary_password": requested_password}, status=201))


@csrf_exempt
def logout_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    record_audit(request, "Logged out", object_type="User", object_id=getattr(request.user, "id", ""))
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
    record_audit(request, "Logged out from all devices", object_type="User", object_id=request.user.id)
    logout(request)
    return cors(JsonResponse({"ok": True}))


def current_user_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return cors(JsonResponse({"authenticated": False}, status=401))
    record_audit(request, "Viewed current profile", object_type="User", object_id=request.user.id)
    return cors(JsonResponse({"authenticated": True, "user": user_payload(request.user)}))


@csrf_exempt
def change_password_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    current_password = str(payload.get("current_password") or "")
    new_password = str(payload.get("new_password") or "")

    if not current_password:
        return cors(JsonResponse({"error": "Current temporary password is required."}, status=400))
    if not request.user.check_password(current_password):
        return cors(JsonResponse({"error": "Current temporary password is incorrect."}, status=400))
    if len(new_password) < 8:
        return cors(JsonResponse({"error": "New password must be at least 8 characters."}, status=400))
    if current_password == new_password:
        return cors(JsonResponse({"error": "Choose a new password different from the temporary password."}, status=400))
    password_error = validate_password_response(new_password, request.user)
    if password_error:
        return password_error

    request.user.set_password(new_password)
    request.user.save(update_fields=["password"])
    profile = ensure_user_profile(request.user)
    profile.must_change_password = False
    profile.save(update_fields=["must_change_password", "updated_at"])
    # End the session and instruct the client to redirect to the login portal
    logout(request)
    record_audit(request, "Changed first-login password", object_type="User", object_id=request.user.id)
    return cors(JsonResponse({"ok": True, "redirect": "/auth/login", "message": "Password changed; please sign in with your new password."}))


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
    if role and role not in VALID_PROFILE_ROLES:
        return cors(JsonResponse({"error": "Invalid user role."}, status=400))
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
    if role:
        sync_user_role_group(target_user, role)
    record_audit(
        request,
        "Updated user profile",
        object_type="User",
        object_id=target_user.id,
        details={"role": role or user_payload(target_user)["role"]},
    )
    return cors(JsonResponse({"user": user_payload(target_user)}))


def admin_users_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if not (request.user.is_staff or request.user.is_superuser):
        return cors(JsonResponse({"error": "Only administrators can view user accounts."}, status=403))
    if request.method != "GET":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    users = list(User.objects.all())
    payload = [user_payload(u) for u in users]
    record_audit(request, "Viewed user list", object_type="UserList")
    return cors(JsonResponse({"users": payload}))


@csrf_exempt
def admin_reset_user_password_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    try:
        target_user_id = int(payload.get("id") or payload.get("user_id"))
    except (TypeError, ValueError):
        return cors(JsonResponse({"error": "Valid user id is required."}, status=400))

    target_user = User.objects.filter(id=target_user_id).first()
    if target_user is None:
        return cors(JsonResponse({"error": "User account not found."}, status=404))
    if target_user.is_superuser and not request.user.is_superuser:
        return cors(JsonResponse({"error": "Only a superuser can reset a superuser password."}, status=403))

    requested_password = str(payload.get("password") or "").strip()
    if requested_password and len(requested_password) < 8:
        return cors(JsonResponse({"error": "Temporary password must be at least 8 characters."}, status=400))
    if requested_password:
        password_error = validate_password_response(requested_password, target_user)
        if password_error:
            return password_error

    temporary_password = requested_password or get_random_string(14)
    target_user.set_password(temporary_password)
    target_user.save(update_fields=["password"])
    profile = ensure_user_profile(target_user)
    profile.must_change_password = True
    profile.save(update_fields=["must_change_password", "updated_at"])
    record_audit(request, "Reset user password", object_type="User", object_id=target_user.id)
    return cors(JsonResponse({
        "user": user_payload(target_user),
        "temporary_password": temporary_password,
        "message": "Temporary password generated. Share it securely and ask the user to change it after login.",
    }))


@csrf_exempt
def admin_update_user_status_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    try:
        target_user_id = int(payload.get("id") or payload.get("user_id"))
    except (TypeError, ValueError):
        return cors(JsonResponse({"error": "Valid user id is required."}, status=400))

    target_user = User.objects.filter(id=target_user_id).first()
    if target_user is None:
        return cors(JsonResponse({"error": "User account not found."}, status=404))
    if target_user.id == request.user.id and payload.get("is_active") is False:
        return cors(JsonResponse({"error": "You cannot disable your own account."}, status=400))
    if target_user.is_superuser and not request.user.is_superuser:
        return cors(JsonResponse({"error": "Only a superuser can change a superuser account status."}, status=403))

    target_user.is_active = bool(payload.get("is_active"))
    target_user.save(update_fields=["is_active"])
    action = "Activated user account" if target_user.is_active else "Disabled user account"
    record_audit(request, action, object_type="User", object_id=target_user.id)
    return cors(JsonResponse({"user": user_payload(target_user)}))


@csrf_exempt
def admin_delete_user_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    try:
        target_user_id = int(payload.get("id") or payload.get("user_id"))
    except (TypeError, ValueError):
        return cors(JsonResponse({"error": "Valid user id is required."}, status=400))

    target_user = User.objects.filter(id=target_user_id).first()
    if target_user is None:
        return cors(JsonResponse({"error": "User account not found."}, status=404))
    if target_user.id == request.user.id:
        return cors(JsonResponse({"error": "You cannot delete your own account."}, status=400))
    if target_user.is_superuser and not request.user.is_superuser:
        return cors(JsonResponse({"error": "Only a superuser can delete a superuser account."}, status=403))

    deleted_user = user_payload(target_user)
    target_user.delete()
    record_audit(request, "Deleted user account", object_type="User", object_id=target_user_id)
    return cors(JsonResponse({"deleted": True, "user": deleted_user}))


def validate_password_response(password, user=None):
    try:
        validate_password(password, user=user)
    except ValidationError as exc:
        return cors(JsonResponse({"error": " ".join(exc.messages)}, status=400))
    return None


@csrf_exempt
def settings_facility_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())

    # Anyone authenticated may view the selected hospital; only admins may modify it
    auth_error = require_login(request)
    if auth_error:
        return auth_error

    if request.method == "GET":
        setting = SystemSetting.objects.filter(setting_key="selected_facility").first()
        if not setting:
            return cors(JsonResponse({"facility": None}))
        try:
            value = _json.loads(setting.setting_value)
        except Exception:
            value = None
        facility = value.get("facility") if isinstance(value, dict) else None
        return cors(JsonResponse({"facility": facility}))

    if request.method == "POST":
        # only admin/superuser may change model facility
        admin_error = require_admin(request)
        if admin_error:
            return admin_error
        payload = json_body(request)
        facility_id = payload.get("facility_id") or payload.get("id")
        if not facility_id:
            return cors(JsonResponse({"error": "facility_id is required"}, status=400))
        facility = HOSPITALS_BY_ID.get(facility_id)
        if not facility:
            return cors(JsonResponse({"error": "Unknown facility id"}, status=400))

        stored = {
            "facility": facility,
            "updated_by": getattr(request.user, "id", None),
            "updated_at": timezone.now().isoformat(),
        }
        setting, _created = SystemSetting.objects.update_or_create(
            setting_key="selected_facility",
            defaults={"setting_value": _json.dumps(stored), "description": "Selected facility for model footer"},
        )
        record_audit(request, "Updated selected facility", object_type="SystemSetting", object_id=setting.id, details={"facility_id": facility_id})
        return cors(JsonResponse({"facility": facility}))

    return cors(JsonResponse({"error": "method not allowed"}, status=405))
