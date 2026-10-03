from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_LIFETIME = timedelta(hours=12)


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
        return User.objects.get(pk=payload["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError, User.DoesNotExist):
        return None
