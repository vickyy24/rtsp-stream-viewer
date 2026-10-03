import base64
import hashlib
import hmac
import json
import logging
import secrets
from functools import wraps

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import User
from .tokens import (
    create_access_token,
    get_user_from_access_token,
)

logger = logging.getLogger(__name__)
MAX_REQUEST_BYTES = 8192
SIGNUP_TOKEN_SALT = "accounts.signup-verification"
SIGNUP_TOKEN_TTL = 10 * 60
SIGNUP_MAX_ATTEMPTS = 5


def _signup_cache_key(kind, value):
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return f"signup:{kind}:{digest}"


def _signup_token_cipher():
    key_material = hashlib.sha256(
        f"signup-verification:{settings.SECRET_KEY}".encode("utf-8")
    ).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))


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
        logger.error("Signup is unavailable because email delivery is not configured")
        return JsonResponse(
            {"error": "Sign up is temporarily unavailable. Please try again later."}, status=503
        )

    if User.objects.filter(email=email).exists():
        return JsonResponse({"error": "An account with this email already exists."}, status=409)

    send_key = _signup_cache_key("send", email)
    if not cache.add(send_key, True, timeout=30):
        return JsonResponse({"error": "A verification code was sent recently. Wait 30 seconds before requesting another."}, status=429)

    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge_id = secrets.token_urlsafe(24)
    temporary_user = User(email=email, full_name=full_name.strip())
    temporary_user.set_password(password)
    code_hash = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        f"{email}:{code}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    try:
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
    except Exception:
        cache.delete(send_key)
        logger.exception("Unable to create account or send its verification email")
        return JsonResponse(
            {"error": "Signup email could not be sent. Please try again later."}, status=503
        )

    cache.set(_signup_cache_key("active", email), challenge_id, timeout=SIGNUP_TOKEN_TTL)
    cache.set(_signup_cache_key("attempts", challenge_id), 0, timeout=SIGNUP_TOKEN_TTL)
    signed_challenge = signing.dumps(
        {
            "id": challenge_id,
            "email": email,
            "full_name": full_name.strip(),
            "password_hash": temporary_user.password,
            "code_hash": code_hash,
        },
        salt=SIGNUP_TOKEN_SALT,
        compress=True,
    )
    challenge_token = _signup_token_cipher().encrypt(signed_challenge.encode("utf-8")).decode("ascii")
    return JsonResponse(
        {"message": "A verification code was sent to your email.", "challenge_token": challenge_token},
        status=202,
    )


@csrf_exempt
@require_http_methods(["POST"])
def verify_email(request):
    payload = _payload(request)
    email = payload.get("email") if payload else None
    code = payload.get("code") if payload else None
    challenge_token = payload.get("challenge_token") if payload else None
    if not isinstance(email, str) or not isinstance(code, str) or not isinstance(challenge_token, str):
        return JsonResponse({"error": "Enter the email address and six-digit verification code."}, status=400)
    email = email.strip().lower()
    if len(code) != 6 or not code.isdigit() or len(challenge_token) > 4096:
        return JsonResponse({"error": "Enter the six-digit code sent to your email."}, status=400)

    try:
        signed_challenge = _signup_token_cipher().decrypt(challenge_token.encode("ascii"))
        challenge = signing.loads(
            signed_challenge.decode("utf-8"),
            salt=SIGNUP_TOKEN_SALT,
            max_age=SIGNUP_TOKEN_TTL,
        )
    except (InvalidToken, UnicodeEncodeError, UnicodeDecodeError, signing.BadSignature):
        return JsonResponse({"error": "This verification code expired. Sign up again to request a new code."}, status=400)

    if (
        not isinstance(challenge, dict)
        or challenge.get("email") != email
        or not isinstance(challenge.get("id"), str)
        or not isinstance(challenge.get("full_name"), str)
        or not isinstance(challenge.get("password_hash"), str)
        or not isinstance(challenge.get("code_hash"), str)
        or cache.get(_signup_cache_key("active", email)) != challenge.get("id")
    ):
        return JsonResponse({"error": "This verification code is invalid or expired. Sign up again to get a new code."}, status=400)

    attempts_key = _signup_cache_key("attempts", challenge["id"])
    if cache.get(attempts_key) is None:
        return JsonResponse({"error": "This verification code expired. Sign up again to request a new code."}, status=400)
    attempts = cache.incr(attempts_key)
    if attempts > SIGNUP_MAX_ATTEMPTS:
        cache.delete(_signup_cache_key("active", email))
        cache.delete(attempts_key)
        return JsonResponse({"error": "Too many incorrect attempts. Sign up again to request a new code."}, status=400)

    submitted_hash = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        f"{email}:{code}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(challenge["code_hash"], submitted_hash):
        return JsonResponse({"error": "That verification code is incorrect."}, status=400)

    try:
        with transaction.atomic():
            user = User(
                email=email,
                full_name=challenge["full_name"],
                password=challenge["password_hash"],
            )
            user.save()
    except IntegrityError:
        cache.delete(_signup_cache_key("active", email))
        cache.delete(attempts_key)
        return JsonResponse({"error": "An account with this email already exists."}, status=409)

    cache.delete(_signup_cache_key("active", email))
    cache.delete(attempts_key)
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
    return JsonResponse({"token": create_access_token(user), "user": _user_data(user)})


@require_http_methods(["GET"])
@require_user
def current_user(request):
    return JsonResponse({"user": _user_data(request.user)})
