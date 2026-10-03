import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
local_env_file = BASE_DIR / ".env"
if local_env_file.exists():
    load_dotenv(local_env_file)
elif os.environ.get("DJANGO_DEBUG", "false").lower() == "true":
    load_dotenv(BASE_DIR / ".env.example")

DEBUG = os.environ.get("DJANGO_DEBUG", "false").lower() == "true"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is false.")
    SECRET_KEY = "development-only-insecure-key"
CAMERA_URL_ENCRYPTION_KEY = os.environ.get("CAMERA_URL_ENCRYPTION_KEY", "")
if not CAMERA_URL_ENCRYPTION_KEY:
    if not DEBUG:
        raise RuntimeError("CAMERA_URL_ENCRYPTION_KEY must be set when DJANGO_DEBUG is false.")
    CAMERA_URL_ENCRYPTION_KEY = "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "daphne",
    "channels",
    "corsheaders",
    "django.contrib.contenttypes",
    "streams.apps.StreamsConfig",
]

database_url = os.environ.get("DATABASE_URL")
if not database_url and not DEBUG:
    raise RuntimeError("DATABASE_URL must be set when DJANGO_DEBUG is false.")
database_url = database_url or f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
DATABASES = {
    "default": dj_database_url.parse(
        database_url,
        conn_max_age=600,
        conn_health_checks=True,
    )
}

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

cors_allowed_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
if DEBUG and not cors_allowed_origins.strip():
    cors_allowed_origins = ",".join(
        f"http://{host}:{port}"
        for host in ("localhost", "127.0.0.1")
        for port in (5173, 5174)
    )
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in cors_allowed_origins.split(",")
    if origin.strip()
]
production_frontend_origin = "https://rtsp-stream-viewer-roan.vercel.app"
if not DEBUG and production_frontend_origin not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(production_frontend_origin)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = os.environ.get(
    "DJANGO_SECURE_SSL_REDIRECT", "false"
).lower() == "true"
CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
}

FFMPEG_BINARY = os.environ.get("FFMPEG_BINARY", "ffmpeg")
RTSP_MAX_CONCURRENT_STREAMS = max(
    1,
    int(os.environ.get("RTSP_MAX_CONCURRENT_STREAMS", "4")),
)
