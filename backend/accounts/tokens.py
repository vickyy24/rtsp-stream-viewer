from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings
from django.core import signing

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_LIFETIME = timedelta(hours=12)
VERIFICATION_SALT = "accounts.email-verification"


def create_access_token(user):
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user.pk),
            "iat": now,
            "exp": now + ACCESS_TOKEN_LIFETIME,
        },
        settings.SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


def get_user_from_access_token(token):
    from .models import User

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return User.objects.get(pk=payload["sub"], is_verified=True)
    except (jwt.PyJWTError, KeyError, TypeError, ValueError, User.DoesNotExist):
        return None


def create_verification_token(user):
    return signing.dumps({"user_id": user.pk}, salt=VERIFICATION_SALT)


def get_user_from_verification_token(token):
    from .models import User

    try:
        payload = signing.loads(token, salt=VERIFICATION_SALT, max_age=60 * 60 * 24)
        return User.objects.get(pk=payload["user_id"])
    except (signing.BadSignature, KeyError, TypeError, ValueError, User.DoesNotExist):
        return None
