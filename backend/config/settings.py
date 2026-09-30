import os
from pathlib import Path

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
STREAM_ACCESS_KEY = os.environ.get("STREAM_ACCESS_KEY", "")
if not DEBUG and not STREAM_ACCESS_KEY:
    raise RuntimeError("STREAM_ACCESS_KEY must be set when DJANGO_DEBUG is false.")
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "daphne",
    "channels",
    "corsheaders",
    "streams.apps.StreamsConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
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
