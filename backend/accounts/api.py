import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from functools import wraps
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.http import HttpResponseRedirect, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from .models import User
from .email_delivery import (
    OTP_EXPIRATION_SECONDS,
    email_delivery_configured,
    send_otp_email,
)
from .tokens import (
    create_access_token,
    get_user_from_access_token,
)

logger = logging.getLogger(__name__)
MAX_REQUEST_BYTES = 8192
SIGNUP_TOKEN_SALT = "accounts.signup-verification"
SIGNUP_TOKEN_TTL = OTP_EXPIRATION_SECONDS
SIGNUP_CHALLENGE_TTL = 24 * 60 * 60
SIGNUP_MAX_ATTEMPTS = 5
PASSWORD_RESET_TOKEN_SALT = "accounts.password-reset"
PASSWORD_RESET_TOKEN_TTL = OTP_EXPIRATION_SECONDS
GOOGLE_OAUTH_COOKIE = "signal_google_oauth"
GOOGLE_OAUTH_COOKIE_SALT = "accounts.google-oauth"
GOOGLE_OAUTH_COOKIE_TTL = 10 * 60
GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def _signup_cache_key(kind, value):
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return f"signup:{kind}:{digest}"


def _signup_token_cipher():
    key_material = hashlib.sha256(
        f"signup-verification:{settings.SECRET_KEY}".encode("utf-8")
    ).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))


def _password_reset_token_cipher():
    key_material = hashlib.sha256(
        f"password-reset:{settings.SECRET_KEY}".encode("utf-8")
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


def _google_oauth_error_redirect(code):
    return HttpResponseRedirect(f"{settings.FRONTEND_URL}/signin?oauthError={code}")


def _google_oauth_configured():
    return bool(
        settings.GOOGLE_OAUTH_CLIENT_ID
        and settings.GOOGLE_OAUTH_CLIENT_SECRET
        and settings.GOOGLE_OAUTH_REDIRECT_URI
    )


def _google_json_request(url, *, data=None, access_token=None):
    headers = {"accept": "application/json"}
    if data is not None:
        headers["content-type"] = "application/x-www-form-urlencoded"
    if access_token:
        headers["authorization"] = f"Bearer {access_token}"
    request = Request(url, data=data, headers=headers, method="POST" if data is not None else "GET")
    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read())
    except HTTPError as error:
        logger.warning("Google OAuth endpoint returned HTTP %s", error.code)
        raise RuntimeError("Google OAuth request failed.") from None
    except (URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as error:
        logger.warning("Google OAuth request failed: %s", type(error).__name__)
        raise RuntimeError("Google OAuth request failed.") from None
    if not isinstance(payload, dict):
        raise RuntimeError("Google OAuth returned an invalid response.")
    return payload


@require_GET
def google_oauth_start(request):
    if not _google_oauth_configured():
        return _google_oauth_error_redirect("not-configured")

    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")
    authorization_url = f"{GOOGLE_AUTHORIZATION_URL}?{urlencode({
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'redirect_uri': settings.GOOGLE_OAUTH_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'openid email profile',
        'state': state,
        'code_challenge': challenge,
        'code_challenge_method': 'S256',
    })}"
    response = HttpResponseRedirect(authorization_url)
    response.set_cookie(
        GOOGLE_OAUTH_COOKIE,
        signing.dumps({"state": state, "verifier": verifier}, salt=GOOGLE_OAUTH_COOKIE_SALT),
        max_age=GOOGLE_OAUTH_COOKIE_TTL,
        httponly=True,
        secure=request.is_secure(),
        samesite="Lax",
        path="/api/auth/google/callback/",
    )
    response["Cache-Control"] = "no-store"
    return response


@require_GET
def google_oauth_callback(request):
    if not _google_oauth_configured():
        return _google_oauth_error_redirect("not-configured")
    if request.GET.get("error"):
        response = _google_oauth_error_redirect("cancelled")
        response.delete_cookie(GOOGLE_OAUTH_COOKIE, path="/api/auth/google/callback/", samesite="Lax")
        return response

    state = request.GET.get("state", "")
    code = request.GET.get("code", "")
    cookie = request.COOKIES.get(GOOGLE_OAUTH_COOKIE, "")
    try:
        oauth_session = signing.loads(cookie, salt=GOOGLE_OAUTH_COOKIE_SALT, max_age=GOOGLE_OAUTH_COOKIE_TTL)
    except signing.BadSignature:
        oauth_session = None
    if (
        not isinstance(oauth_session, dict)
        or not isinstance(oauth_session.get("state"), str)
        or not isinstance(oauth_session.get("verifier"), str)
        or not state
        or not secrets.compare_digest(state, oauth_session["state"])
        or not code
    ):
        response = _google_oauth_error_redirect("invalid-state")
        response.delete_cookie(GOOGLE_OAUTH_COOKIE, path="/api/auth/google/callback/", samesite="Lax")
        return response

    try:
        token_payload = _google_json_request(
            GOOGLE_TOKEN_URL,
            data=urlencode({
                "code": code,
                "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
                "grant_type": "authorization_code",
                "code_verifier": oauth_session["verifier"],
            }).encode("ascii"),
        )
        access_token = token_payload.get("access_token")
        if not isinstance(access_token, str) or not access_token:
            raise RuntimeError("Google OAuth did not return an access token.")
        profile = _google_json_request(GOOGLE_USERINFO_URL, access_token=access_token)
        email = profile.get("email")
        google_id = profile.get("sub")
        if (
            not isinstance(email, str)
            or not isinstance(google_id, str)
            or not google_id
            or profile.get("email_verified") is not True
        ):
            raise RuntimeError("Google did not provide a verified email address.")
        email = email.strip().lower()
        validate_email(email)

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            full_name = profile.get("name")
            full_name = full_name.strip()[:150] if isinstance(full_name, str) else ""
            user = User(email=email, full_name=full_name or email.partition("@")[0])
            user.set_password(None)
            try:
                with transaction.atomic():
                    user.save()
            except IntegrityError:
                user = User.objects.filter(email__iexact=email).first()
                if user is None:
                    raise
        response = HttpResponseRedirect(
            f"{settings.FRONTEND_URL}/signin#googleToken={create_access_token(user)}"
        )
    except (RuntimeError, ValidationError):
        logger.info("Google OAuth sign-in could not be completed")
        response = _google_oauth_error_redirect("failed")

    response.delete_cookie(GOOGLE_OAUTH_COOKIE, path="/api/auth/google/callback/", samesite="Lax")
    response["Cache-Control"] = "no-store"
    return response


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
    if not email_delivery_configured():
        logger.error("Signup is unavailable because email delivery is not configured")
        return JsonResponse(
            {"error": "Sign up is temporarily unavailable. Please try again later."}, status=503
        )

    if User.objects.filter(email=email).exists():
        return JsonResponse({"error": "An account with this email already exists."}, status=409)

    send_started_at = time.monotonic()
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
        send_otp_email(email, code, "signup")
    except Exception:
        cache.delete(send_key)
        logger.exception("Unable to create account or send its verification email")
        return JsonResponse(
            {"error": "Signup email could not be sent. Please try again later."}, status=503
        )

    code_created_at = int(time.time())
    cache.set(_signup_cache_key("active", email), challenge_id, timeout=SIGNUP_CHALLENGE_TTL)
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
        {
            "message": "A verification code request was accepted.",
            "challenge_token": challenge_token,
            "code_expires_at": code_created_at + SIGNUP_TOKEN_TTL,
            "resend_after_seconds": max(0, 30 - int(time.monotonic() - send_started_at)),
        },
        status=202,
    )


@csrf_exempt
@require_http_methods(["POST"])
def resend_signup_verification(request):
    payload = _payload(request)
    email = payload.get("email") if payload else None
    challenge_token = payload.get("challenge_token") if payload else None
    if not isinstance(email, str) or not isinstance(challenge_token, str):
        return JsonResponse({"error": "Request a new code from your signup session."}, status=400)
    email = email.strip().lower()
    if len(challenge_token) > 4096:
        return JsonResponse({"error": "Your signup session is invalid. Start signup again."}, status=400)
    try:
        signed_challenge = _signup_token_cipher().decrypt(challenge_token.encode("ascii"))
        challenge = signing.loads(
            signed_challenge.decode("utf-8"),
            salt=SIGNUP_TOKEN_SALT,
            max_age=SIGNUP_CHALLENGE_TTL,
        )
    except (InvalidToken, UnicodeEncodeError, UnicodeDecodeError, signing.BadSignature):
        return JsonResponse({"error": "Your signup session expired. Start signup again to request a new code."}, status=400)

    if (
        not isinstance(challenge, dict)
        or challenge.get("email") != email
        or not isinstance(challenge.get("id"), str)
        or not isinstance(challenge.get("full_name"), str)
        or not isinstance(challenge.get("password_hash"), str)
        or not isinstance(challenge.get("code_hash"), str)
    ):
        return JsonResponse({"error": "Your signup session is no longer active. Start signup again."}, status=400)

    send_started_at = time.monotonic()
    send_key = _signup_cache_key("send", email)
    if not cache.add(send_key, True, timeout=30):
        return JsonResponse({"error": "Please wait 30 seconds before requesting another code."}, status=429)

    code = f"{secrets.randbelow(1_000_000):06d}"
    new_challenge = {**challenge, "id": secrets.token_urlsafe(24)}
    new_challenge["code_hash"] = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        f"{email}:{code}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    try:
        send_otp_email(email, code, "signup")
    except Exception:
        cache.delete(send_key)
        logger.exception("Unable to resend signup verification email")
        return JsonResponse({"error": "The email service could not send a new code. Please try again."}, status=503)

    code_created_at = int(time.time())
    cache.set(_signup_cache_key("active", email), new_challenge["id"], timeout=SIGNUP_CHALLENGE_TTL)
    cache.set(_signup_cache_key("attempts", new_challenge["id"]), 0, timeout=SIGNUP_TOKEN_TTL)
    signed_new_challenge = signing.dumps(new_challenge, salt=SIGNUP_TOKEN_SALT, compress=True)
    new_token = _signup_token_cipher().encrypt(signed_new_challenge.encode("utf-8")).decode("ascii")
    return JsonResponse(
        {
            "message": "A new verification code request was accepted.",
            "challenge_token": new_token,
            "code_expires_at": code_created_at + SIGNUP_TOKEN_TTL,
            "resend_after_seconds": max(0, 30 - int(time.monotonic() - send_started_at)),
        },
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

    active_challenge_id = cache.get(_signup_cache_key("active", email))
    if (
        not isinstance(challenge, dict)
        or challenge.get("email") != email
        or not isinstance(challenge.get("id"), str)
        or not isinstance(challenge.get("full_name"), str)
        or not isinstance(challenge.get("password_hash"), str)
        or not isinstance(challenge.get("code_hash"), str)
        or (active_challenge_id is not None and active_challenge_id != challenge.get("id"))
    ):
        return JsonResponse({"error": "This verification code is invalid or expired. Sign up again to get a new code."}, status=400)

    attempts_key = _signup_cache_key("attempts", challenge["id"])
    # The signed challenge is authoritative for its 10-minute lifetime. Cache entries
    # are only for attempt limiting and can disappear when a hosted worker restarts.
    cache.add(attempts_key, 0, timeout=SIGNUP_TOKEN_TTL)
    attempts = cache.incr(attempts_key)
    if attempts > SIGNUP_MAX_ATTEMPTS:
        cache.set(_signup_cache_key("active", email), f"blocked:{challenge['id']}", timeout=SIGNUP_TOKEN_TTL)
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
def request_password_reset(request):
    payload = _payload(request)
    email = payload.get("email") if payload else None
    if not isinstance(email, str) or len(email.strip()) > 254:
        return JsonResponse({"error": "Enter a valid email address."}, status=400)
    email = email.strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({"error": "Enter a valid email address."}, status=400)

    response_message = "If an account exists for this email, a password reset code has been sent."
    send_key = _signup_cache_key("password-reset-send", email)
    if not cache.add(send_key, True, timeout=30):
        return JsonResponse(
            {"error": "Wait 30 seconds before requesting another reset code."},
            status=429,
        )

    if not email_delivery_configured():
        cache.delete(send_key)
        logger.error("Password reset is unavailable because email delivery is not configured")
        return JsonResponse(
            {"error": "Password reset is temporarily unavailable. Please try again later."},
            status=503,
        )
    user = User.objects.filter(email=email).first()

    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge_id = secrets.token_urlsafe(24)
    code_hash = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        f"password-reset:{email}:{challenge_id}:{code}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    cache.set(_signup_cache_key("password-reset-active", email), challenge_id, timeout=PASSWORD_RESET_TOKEN_TTL)
    cache.set(_signup_cache_key("password-reset-attempts", challenge_id), 0, timeout=PASSWORD_RESET_TOKEN_TTL)

    if user:
        try:
            send_otp_email(email, code, "password_reset")
        except Exception:
            cache.delete(_signup_cache_key("password-reset-active", email))
            cache.delete(_signup_cache_key("password-reset-attempts", challenge_id))
            cache.delete(send_key)
            logger.exception("Unable to send password reset email")
            return JsonResponse(
                {"error": "The reset email could not be sent. Please try again later."},
                status=503,
            )

    signed_challenge = signing.dumps(
        {"id": challenge_id, "email": email, "code_hash": code_hash},
        salt=PASSWORD_RESET_TOKEN_SALT,
        compress=True,
    )
    challenge_token = _password_reset_token_cipher().encrypt(signed_challenge.encode("utf-8")).decode("ascii")
    return JsonResponse(
        {"message": response_message, "challenge_token": challenge_token},
        status=202,
    )


@csrf_exempt
@require_http_methods(["POST"])
def reset_password(request):
    payload = _payload(request)
    email = payload.get("email") if payload else None
    code = payload.get("code") if payload else None
    new_password = payload.get("new_password") if payload else None
    challenge_token = payload.get("challenge_token") if payload else None
    if not all(isinstance(value, str) for value in (email, code, new_password, challenge_token)):
        return JsonResponse({"error": "Enter your email, code, and new password."}, status=400)
    email = email.strip().lower()
    if len(code) != 6 or not code.isdigit() or len(challenge_token) > 4096:
        return JsonResponse({"error": "Enter the six-digit reset code sent to your email."}, status=400)
    if len(new_password) < 10 or len(new_password) > 128:
        return JsonResponse({"error": "Password must be between 10 and 128 characters."}, status=400)

    try:
        signed_challenge = _password_reset_token_cipher().decrypt(challenge_token.encode("ascii"))
        challenge = signing.loads(
            signed_challenge.decode("utf-8"),
            salt=PASSWORD_RESET_TOKEN_SALT,
            max_age=PASSWORD_RESET_TOKEN_TTL,
        )
    except (InvalidToken, UnicodeEncodeError, UnicodeDecodeError, signing.BadSignature):
        return JsonResponse({"error": "This reset code expired. Request a new code."}, status=400)

    if (
        not isinstance(challenge, dict)
        or challenge.get("email") != email
        or not isinstance(challenge.get("id"), str)
        or not isinstance(challenge.get("code_hash"), str)
        or cache.get(_signup_cache_key("password-reset-active", email)) != challenge.get("id")
    ):
        return JsonResponse({"error": "This reset code is invalid or expired. Request a new code."}, status=400)

    attempts_key = _signup_cache_key("password-reset-attempts", challenge["id"])
    if cache.get(attempts_key) is None:
        return JsonResponse({"error": "This reset code expired. Request a new code."}, status=400)
    if cache.incr(attempts_key) > SIGNUP_MAX_ATTEMPTS:
        cache.delete(_signup_cache_key("password-reset-active", email))
        cache.delete(attempts_key)
        return JsonResponse({"error": "Too many incorrect attempts. Request a new reset code."}, status=400)

    submitted_hash = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        f"password-reset:{email}:{challenge['id']}:{code}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(challenge["code_hash"], submitted_hash):
        return JsonResponse({"error": "That reset code is incorrect."}, status=400)

    user = User.objects.filter(email=email).first()
    if user is None:
        return JsonResponse({"error": "This reset code is invalid or expired. Request a new code."}, status=400)
    user.set_password(new_password)
    user.save(update_fields=["password"])
    cache.delete(_signup_cache_key("password-reset-active", email))
    cache.delete(attempts_key)
    return JsonResponse({"message": "Your password has been reset. Sign in with your new password."})


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
