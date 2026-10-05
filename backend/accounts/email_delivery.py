import base64
from email.message import EmailMessage

from django.conf import settings
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"


def email_delivery_configured():
    return bool(
        settings.GMAIL_CLIENT_ID
        and settings.GMAIL_CLIENT_SECRET
        and settings.GMAIL_REFRESH_TOKEN
        and settings.GMAIL_SENDER_EMAIL
    )


def send_transactional_email(*, subject, message, recipient, recipient_name=""):
    if not email_delivery_configured():
        raise RuntimeError("Gmail API email delivery is missing OAuth credentials or a sender address.")

    email = EmailMessage()
    email["From"] = settings.GMAIL_SENDER_EMAIL
    email["To"] = recipient
    email["Subject"] = subject
    email.set_content(message)
    raw_message = base64.urlsafe_b64encode(email.as_bytes()).decode("ascii")

    credentials = Credentials(
        token=None,
        refresh_token=settings.GMAIL_REFRESH_TOKEN,
        token_uri=GOOGLE_TOKEN_URI,
        client_id=settings.GMAIL_CLIENT_ID,
        client_secret=settings.GMAIL_CLIENT_SECRET,
        scopes=[GMAIL_SEND_SCOPE],
    )
    gmail = build("gmail", "v1", credentials=credentials, cache_discovery=False)
    result = gmail.users().messages().send(
        userId="me",
        body={"raw": raw_message},
    ).execute()
    if not isinstance(result, dict) or not result.get("id"):
        raise RuntimeError("Gmail API did not confirm the transactional email.")
    return 1
