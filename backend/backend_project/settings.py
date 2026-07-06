import os
from pathlib import Path
from dotenv import load_dotenv
from corsheaders.defaults import default_headers
import dj_database_url
from django.core.exceptions import ImproperlyConfigured

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


def env_list(name, default):
    value = os.getenv(name)
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name, default=0):
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def postgres_env_url():
    host = os.getenv("POSTGRES_HOST", "").strip()
    if not host or host in {"localhost", "127.0.0.1", "db"}:
        return ""
    return "postgres://{user}:{password}@{host}:{port}/{name}".format(
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres"),
        host=host,
        port=os.getenv("POSTGRES_PORT", "5432"),
        name=os.getenv("POSTGRES_DB", "postop"),
    )


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "change-me-for-prod")
IS_RENDER = env_bool("RENDER", False) or bool(os.getenv("RENDER_EXTERNAL_HOSTNAME"))
DEBUG = env_bool("DJANGO_DEBUG", not IS_RENDER)
if not DEBUG and SECRET_KEY == "change-me-for-prod":
    raise ImproperlyConfigured("Set DJANGO_SECRET_KEY to a strong unique value before running in production.")
LOCAL_PC_IP = os.getenv("LOCAL_PC_IP", "").strip()
LOCAL_WIFI_IP = os.getenv("LOCAL_WIFI_IP", "").strip()
LOCAL_LAN_IP = LOCAL_PC_IP or LOCAL_WIFI_IP
ALLOWED_HOSTS = env_list(
    "DJANGO_ALLOWED_HOSTS",
    ["localhost", 
    "rwandox-1.onrender.com","127.0.0.1", "testserver", "rwandoxy.com", "www.rwandoxy.com"],
)
if LOCAL_LAN_IP and LOCAL_LAN_IP not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(LOCAL_LAN_IP)
if DEBUG and env_bool("DJANGO_ALLOW_LAN_HOSTS", True) and "*" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append("*")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    # Local apps (from the attached project)
    "apps.accounts",
    "apps.dashboard",
    "apps.patients",
    "apps.perioperative",
    "apps.predictions",
    "apps.explainability",
    "apps.auditlog",
    "apps.support",
    "corsheaders",
    "apps.api",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    # keep CORS middleware near the top
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend_project.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend_project.wsgi.application"

# Render should provide DATABASE_URL. If a deployment platform exposes separate
# PostgreSQL variables instead, accept them only when the host is not local.
DATABASE_URL = os.getenv("DATABASE_URL") or postgres_env_url()
if not DATABASE_URL and DEBUG and not IS_RENDER:
    DATABASE_URL = os.getenv(
        "LOCAL_DATABASE_URL",
        "postgres://{user}:{password}@{host}:{port}/{name}".format(
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "postgres"),
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=os.getenv("POSTGRES_PORT", "5432"),
            name=os.getenv("POSTGRES_DB", "postop"),
        ),
    )

if not DATABASE_URL:
    # In production we require an explicit DATABASE_URL. In local
    # development (DEBUG=True) fall back to a local SQLite DB so the
    # project is easier to run without configuring Postgres.
    if not DEBUG:
        raise ImproperlyConfigured(
            "Set DATABASE_URL to the Render PostgreSQL Internal Database URL. "
            "Production will not use localhost or db as the database host."
        )

    # local dev fallback to SQLite
    DATABASE_URL = f"sqlite:///{(BASE_DIR / 'db.sqlite3').as_posix()}"

if not DEBUG and "postgres:postgres@" in DATABASE_URL:
    raise ImproperlyConfigured("Do not use the default postgres/postgres database credentials in production.")

DATABASES = {
    "default": dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=600,
        ssl_require=env_bool("DATABASE_SSL_REQUIRE", not DEBUG),
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": env_int("DJANGO_PASSWORD_MIN_LENGTH", 8)},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]
FAST_LOGIN_PBKDF2_ITERATIONS = int(os.getenv("FAST_LOGIN_PBKDF2_ITERATIONS", "120000"))
PASSWORD_HASHERS = [
    "apps.api.hashers.FastLoginPBKDF2PasswordHasher",
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Kigali"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_DIR = BASE_DIR / "static"
STATICFILES_DIRS = [STATIC_DIR] if STATIC_DIR.exists() else []
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "munyanezajoel11@gmail.com")
EMAIL_BACKEND = os.getenv("DJANGO_EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = env_int("EMAIL_PORT", 587)
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or SUPPORT_EMAIL)

SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", not DEBUG)
SESSION_COOKIE_SECURE = env_bool("DJANGO_SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = env_bool("DJANGO_CSRF_COOKIE_SECURE", not DEBUG)
SECURE_HSTS_SECONDS = env_int("DJANGO_SECURE_HSTS_SECONDS", 31536000 if not DEBUG else 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", not DEBUG)
SECURE_HSTS_PRELOAD = env_bool("DJANGO_SECURE_HSTS_PRELOAD", False)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
if env_bool("DJANGO_USE_X_FORWARDED_PROTO", not DEBUG):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# CORS - allow local development and the deployed RwandOxy domain by default.
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
LOCAL_FRONTEND_ORIGIN = f"http://{LOCAL_LAN_IP}:5173" if LOCAL_LAN_IP else ""
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    [
        FRONTEND_ORIGIN,
        "http://127.0.0.1:5173",
        "https://rwandoxy.com",
        "https://www.rwandoxy.com",
    ],
)
CORS_ALLOWED_ORIGIN_REGEXES = env_list(
    "CORS_ALLOWED_ORIGIN_REGEXES",
    [
        r"^http://localhost:5173$",
        r"^http://127\.0\.0\.1:5173$",
        r"^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$",
        r"^http://192\.168\.\d{1,3}\.\d{1,3}:5173$",
        r"^http://172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:5173$",
    ] if DEBUG else [],
)
if LOCAL_FRONTEND_ORIGIN and LOCAL_FRONTEND_ORIGIN not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(LOCAL_FRONTEND_ORIGIN)
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    ["https://rwandoxy.com", "https://www.rwandoxy.com"],
)
if LOCAL_FRONTEND_ORIGIN and LOCAL_FRONTEND_ORIGIN not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(LOCAL_FRONTEND_ORIGIN)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = list(default_headers) + [
    "authorization",
    "x-user-email",
    "x-user-username",
]
