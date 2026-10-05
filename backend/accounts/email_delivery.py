import base64
import json
from html import escape
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings


MAILJET_SEND_URL = "https://api.mailjet.com/v3.1/send"
MAILJET_TIMEOUT_SECONDS = 10
OTP_EXPIRATION_MINUTES = 10
OTP_EXPIRATION_SECONDS = OTP_EXPIRATION_MINUTES * 60


class EmailDeliveryUnavailable(RuntimeError):
    pass


class MailjetDeliveryError(RuntimeError):
    pass


def email_delivery_configured():
    return bool(
        settings.MAILJET_API_KEY
        and settings.MAILJET_SECRET_KEY
        and settings.MAILJET_FROM_EMAIL
        and settings.MAILJET_FROM_NAME
    )


def send_otp_email(recipient_email, otp):
    if not email_delivery_configured():
        raise EmailDeliveryUnavailable("Mailjet email delivery is not configured.")

    escaped_otp = escape(otp)
    payload = {
        "Messages": [
            {
                "From": {
                    "Email": settings.MAILJET_FROM_EMAIL,
                    "Name": settings.MAILJET_FROM_NAME,
                },
                "To": [{"Email": recipient_email}],
                "Subject": "Your verification code",
                "TextPart": (
                    f"Your verification code is: {otp}\n\n"
                    f"This code expires in {OTP_EXPIRATION_MINUTES} minutes. "
                    "For your security, do not share this code with anyone."
                ),
                "HTMLPart": (
                    "<!doctype html><html><body>"
                    "<h1>Your verification code</h1>"
                    f"<p>Your verification code is: <strong>{escaped_otp}</strong></p>"
                    f"<p>This code expires in {OTP_EXPIRATION_MINUTES} minutes.</p>"
                    "<p>For your security, do not share this code with anyone.</p>"
                    "</body></html>"
                ),
            }
        ]
    }
    authorization = base64.b64encode(
        f"{settings.MAILJET_API_KEY}:{settings.MAILJET_SECRET_KEY}".encode("utf-8")
    ).decode("ascii")
    request = Request(
        MAILJET_SEND_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Basic {authorization}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=MAILJET_TIMEOUT_SECONDS) as response:
            status = response.status
            response_body = response.read()
    except HTTPError as error:
        raise MailjetDeliveryError(
            f"Mailjet rejected the email request (HTTP {error.code})."
        ) from None
    except (URLError, TimeoutError):
        raise MailjetDeliveryError("Mailjet could not be reached or timed out.") from None
    except OSError:
        raise MailjetDeliveryError("Mailjet connection failed.") from None

    if not 200 <= status < 300:
        raise MailjetDeliveryError(f"Mailjet returned HTTP {status}.")
    try:
        result = json.loads(response_body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise MailjetDeliveryError("Mailjet returned an invalid response.") from None

    messages = result.get("Messages") if isinstance(result, dict) else None
    if (
        not isinstance(messages, list)
        or len(messages) != 1
        or not isinstance(messages[0], dict)
        or messages[0].get("Status") != "success"
    ):
        raise MailjetDeliveryError("Mailjet did not confirm email delivery.")
    return True
