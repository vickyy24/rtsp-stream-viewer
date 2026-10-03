import hashlib
import hmac
import json
import logging
import secrets
from datetime import timedelta
from functools import wraps

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from streams.models import Camera
from .models import SignupChallenge, User
from .tokens import (
    create_access_token,
    get_user_from_access_token,
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

    now = timezone.now()
    SignupChallenge.objects.filter(expires_at__lte=now).delete()
    existing_user = User.objects.filter(email=email).first()
    if existing_user and existing_user.is_verified:
        return JsonResponse({"error": "An account with this email already exists."}, status=409)

    pending = SignupChallenge.objects.filter(email=email).first()
    if pending and now - pending.last_sent_at < timedelta(seconds=30):
        return JsonResponse({"error": "A verification code was sent recently. Wait 30 seconds before requesting another."}, status=429)

    code = f"{secrets.randbelow(1_000_000):06d}"
    temporary_user = User(email=email, full_name=full_name.strip())
    temporary_user.set_password(password)
    code_hash = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        f"{email}:{code}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    try:
        with transaction.atomic():
            SignupChallenge.objects.update_or_create(
                email=email,
                defaults={
                    "full_name": full_name.strip(),
                    "password_hash": temporary_user.password,
                    "code_hash": code_hash,
                    "attempts": 0,
                    "expires_at": now + timedelta(minutes=10),
                    "last_sent_at": now,
                },
            )
            send_mail(
                subject="Your Signal verification code",
                message=(
                    f"Hello {full_name.strip()},\n\n"
                    f"Your Signal signup verification code is {code}.\n"
                    "It expires in 10 minutes. If you did not request this code, ignore this email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
    except IntegrityError:
        return JsonResponse({"error": "An account with this email already exists."}, status=409)
    except Exception:
        logger.exception("Unable to create account or send its verification email")
        return JsonResponse(
            {"error": "Signup email could not be sent. Please try again later."}, status=503
        )
    return JsonResponse({"message": "A verification code was sent to your email."}, status=202)


@csrf_exempt
@require_http_methods(["POST"])
def verify_email(request):
    payload = _payload(request)
    email = payload.get("email") if payload else None
    code = payload.get("code") if payload else None
    if not isinstance(email, str) or not isinstance(code, str):
        return JsonResponse({"error": "Enter the email address and six-digit verification code."}, status=400)
    email = email.strip().lower()
    if len(code) != 6 or not code.isdigit():
        return JsonResponse({"error": "Enter the six-digit code sent to your email."}, status=400)

    with transaction.atomic():
        challenge = SignupChallenge.objects.select_for_update().filter(email=email).first()
        if challenge is None:
            return JsonResponse({"error": "This verification code is invalid or expired. Sign up again to get a new code."}, status=400)
        if challenge.expires_at <= timezone.now() or challenge.attempts >= 5:
            challenge.delete()
            return JsonResponse({"error": "This verification code expired. Sign up again to get a new code."}, status=400)
        submitted_hash = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            f"{email}:{code}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(challenge.code_hash, submitted_hash):
            challenge.attempts += 1
            challenge.save(update_fields=["attempts"])
            return JsonResponse({"error": "That verification code is incorrect."}, status=400)

        user = User.objects.select_for_update().filter(email=challenge.email).first()
        if user and user.is_verified:
            challenge.delete()
            return JsonResponse({"error": "An account with this email already exists."}, status=409)
        if user is None:
            user = User(
                email=challenge.email,
                full_name=challenge.full_name,
                password=challenge.password_hash,
                is_verified=True,
            )
            user.save()
        else:
            user.full_name = challenge.full_name
            user.password = challenge.password_hash
            user.is_verified = True
            user.save(update_fields=["full_name", "password", "is_verified"])
        if User.objects.count() == 1:
            Camera.objects.filter(owner__isnull=True).update(owner=user)
        challenge.delete()
        result = {"token": create_access_token(user), "user": _user_data(user)}
    return JsonResponse(result)


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
        return JsonResponse({"error": "Complete email verification before signing in."}, status=403)
    return JsonResponse({"token": create_access_token(user), "user": _user_data(user)})


@require_http_methods(["GET"])
@require_user
def current_user(request):
    return JsonResponse({"user": _user_data(request.user)})
