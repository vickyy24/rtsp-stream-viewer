import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)
BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"


def email_delivery_configured():
    if settings.EMAIL_PROVIDER == "brevo":
        return bool(settings.BREVO_API_KEY and settings.DEFAULT_FROM_EMAIL)
    return bool(settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD)


def send_transactional_email(*, subject, message, recipient, recipient_name=""):
    if settings.EMAIL_PROVIDER == "smtp":
        from django.core.mail import send_mail

        return send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )

    if settings.EMAIL_PROVIDER != "brevo":
        raise RuntimeError("EMAIL_PROVIDER must be set to 'brevo' or 'smtp'.")
    if not email_delivery_configured():
        raise RuntimeError("Brevo email delivery is missing its API key or sender address.")

    payload = json.dumps(
        {
            "sender": {"name": "Signal RTSP Stream Viewer", "email": settings.DEFAULT_FROM_EMAIL},
            "to": [{"email": recipient, **({"name": recipient_name} if recipient_name else {})}],
            "subject": subject,
            "textContent": message,
        }
    ).encode("utf-8")
    request = Request(
        BREVO_SEND_URL,
        data=payload,
        headers={
            "accept": "application/json",
            "api-key": settings.BREVO_API_KEY,
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=settings.EMAIL_TIMEOUT) as response:
            if not 200 <= response.status < 300:
                raise RuntimeError(f"Email API returned HTTP {response.status}.")
            return 1
    except HTTPError as error:
        # Do not include provider response bodies; they may contain recipient data.
        logger.error("Transactional email API returned HTTP %s", error.code)
        raise RuntimeError(f"Email API returned HTTP {error.code}.") from None
    except (URLError, TimeoutError) as error:
        logger.error("Transactional email API request failed: %s", type(error).__name__)
        raise RuntimeError("Email API request failed.") from None
