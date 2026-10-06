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

    escaped_otp = escape(otp, quote=True)
    text_part = (
        "SIGNAL | RTSP STREAM VIEWER\n\n"
        "Your verification code\n\n"
        f"{otp}\n\n"
        f"Enter this code to continue. It expires in {OTP_EXPIRATION_MINUTES} minutes.\n\n"
        "For your security, never share this code. If you did not request it, you can "
        "safely ignore this email."
    )
    html_part = f"""\
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Your verification code</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f5f2;font-family:Arial,Helvetica,sans-serif;color:#17252a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Your one-time Signal verification code. It expires in {OTP_EXPIRATION_MINUTES} minutes.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f5f2;">
      <tr>
        <td align="center" style="padding:36px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
            <tr>
              <td style="padding:0 0 18px 4px;">
                <span style="color:#287f85;font-size:16px;font-weight:700;letter-spacing:3px;">SIGNAL</span>
                <span style="padding-left:8px;color:#718096;font-size:11px;letter-spacing:1.2px;">RTSP STREAM VIEWER</span>
              </td>
            </tr>
            <tr>
              <td style="padding:0;background-color:#ffffff;border:1px solid #e2e8e3;border-radius:12px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="height:4px;background-color:#559b75;border-radius:12px 12px 0 0;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:34px 36px 32px;">
                      <p style="margin:0 0 10px;color:#559b75;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Secure account access</p>
                      <h1 style="margin:0;color:#17252a;font-size:25px;font-weight:600;line-height:1.3;">Your verification code</h1>
                      <p style="margin:12px 0 24px;color:#5f6e70;font-size:15px;line-height:1.6;">Enter this one-time code to continue. It expires in {OTP_EXPIRATION_MINUTES} minutes.</p>
                      <div style="padding:19px 12px;background-color:#f3f7f4;border:1px solid #e1ebe4;border-radius:8px;text-align:center;">
                        <span style="color:#1e514d;font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:700;letter-spacing:9px;line-height:1.2;">{escaped_otp}</span>
                      </div>
                      <p style="margin:22px 0 0;color:#5f6e70;font-size:14px;line-height:1.6;"><strong style="color:#334448;">Keep this code private.</strong> Signal support will never ask you to share it.</p>
                      <p style="margin:10px 0 0;color:#778587;font-size:13px;line-height:1.6;">If you didn't request a code, you can safely ignore this email.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 4px 0;color:#839091;font-size:12px;line-height:1.6;">
                This is an automated account-security message from Signal RTSP Stream Viewer.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""
    payload = {
        "Messages": [
            {
                "From": {
                    "Email": settings.MAILJET_FROM_EMAIL,
                    "Name": settings.MAILJET_FROM_NAME,
                },
                "To": [{"Email": recipient_email}],
                "Subject": "Your verification code",
                "TextPart": text_part,
                "HTMLPart": html_part,
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
