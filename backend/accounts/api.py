import json
import logging
from functools import wraps

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from streams.models import Camera
from .models import User
from .tokens import (
    create_access_token,
    create_verification_token,
    get_user_from_access_token,
    get_user_from_verification_token,
)

logger = logging.getLogger(__name__)
MAX_REQUEST_BYTES = 8192


def _payload(request):
    if len(request.body) > MAX_REQUEST_BYTES:
        return None
    try:
        value = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    return value if isinstance(value, dict) else None


def require_user(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        authorization = request.headers.get("Authorization", "")
        scheme, _, token = authorization.partition(" ")
        user = get_user_from_access_token(token) if scheme.lower() == "bearer" and token else None
        if user is None:
            return JsonResponse({"error": "Sign in to continue."}, status=401)
        request.user = user
        return view(request, *args, **kwargs)

    return wrapped


def _user_data(user):
    return {"id": user.pk, "email": user.email, "full_name": user.full_name}


@csrf_exempt
@require_http_methods(["POST"])
def signup(request):
    payload = _payload(request)
    if payload is None:
        return JsonResponse({"error": "Send valid signup details."}, status=400)
    full_name = payload.get("full_name")
    email = payload.get("email")
    password = payload.get("password")
    if not isinstance(full_name, str) or not full_name.strip() or len(full_name.strip()) > 150:
        return JsonResponse({"error": "Enter your full name (up to 150 characters)."}, status=400)
    if not isinstance(email, str) or len(email.strip()) > 254:
        return JsonResponse({"error": "Enter a valid email address."}, status=400)
    email = email.strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({"error": "Enter a valid email address."}, status=400)
    if not isinstance(password, str) or len(password) < 10 or len(password) > 128:
        return JsonResponse({"error": "Password must be between 10 and 128 characters."}, status=400)
    if not all((settings.EMAIL_HOST, settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD, settings.DEFAULT_FROM_EMAIL)):
        return JsonResponse(
            {"error": "Email verification is not configured on the server yet."}, status=503
        )

    try:
        with transaction.atomic():
            user = User.objects.create_user(email=email, password=password)
            user.full_name = full_name.strip()
            user.save(update_fields=["full_name"])
            if User.objects.count() == 1:
                Camera.objects.filter(owner__isnull=True).update(owner=user)
            verification_url = (
                f"{settings.FRONTEND_URL.rstrip('/')}/verify-email"
                f"?token={create_verification_token(user)}"
            )
            send_mail(
                subject="Verify your Signal account",
                message=(
                    f"Hello {user.full_name},\n\n"
                    f"Verify your email address using this link (valid for 24 hours):\n"
                    f"{verification_url}\n\nIf you did not create this account, ignore this email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
    except IntegrityError:
        return JsonResponse({"error": "An account with this email already exists."}, status=409)
    except Exception:
        logger.exception("Unable to create account or send its verification email")
        return JsonResponse(
            {"error": "Signup email could not be sent. Please try again later."}, status=503
        )
    return JsonResponse({"message": "Check your email for the verification link."}, status=201)


@csrf_exempt
@require_http_methods(["POST"])
def verify_email(request):
    payload = _payload(request)
    token = payload.get("token") if payload else None
    user = get_user_from_verification_token(token) if isinstance(token, str) else None
    if user is None:
        return JsonResponse({"error": "This verification link is invalid or expired."}, status=400)
    if not user.is_verified:
        user.is_verified = True
        user.save(update_fields=["is_verified"])
    return JsonResponse({"message": "Email verified. You can now sign in."})


@csrf_exempt
@require_http_methods(["POST"])
def signin(request):
    payload = _payload(request)
    email = payload.get("email") if payload else None
    password = payload.get("password") if payload else None
    if not isinstance(email, str) or not isinstance(password, str):
        return JsonResponse({"error": "Enter your email and password."}, status=400)
    try:
        user = User.objects.get(email=email.strip().lower())
    except User.DoesNotExist:
        user = None
    if user is None or not user.check_password(password):
        return JsonResponse({"error": "Email or password is incorrect."}, status=401)
    if not user.is_verified:
        return JsonResponse({"error": "Verify your email before signing in."}, status=403)
    return JsonResponse({"token": create_access_token(user), "user": _user_data(user)})


@require_http_methods(["GET"])
@require_user
def current_user(request):
    return JsonResponse({"user": _user_data(request.user)})
