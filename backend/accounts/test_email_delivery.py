import base64
from email import message_from_bytes
from email.policy import default
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from .email_delivery import GMAIL_SEND_SCOPE, email_delivery_configured, send_transactional_email


GMAIL_SETTINGS = {
    "GMAIL_CLIENT_ID": "client-id",
    "GMAIL_CLIENT_SECRET": "client-secret",
    "GMAIL_REFRESH_TOKEN": "refresh-token",
    "GMAIL_SENDER_EMAIL": "sender@gmail.com",
}


@override_settings(**GMAIL_SETTINGS)
class GmailApiEmailDeliveryTests(SimpleTestCase):
    def test_email_delivery_requires_all_gmail_oauth_settings(self):
        self.assertTrue(email_delivery_configured())

        with override_settings(GMAIL_REFRESH_TOKEN="", GMAIL_SENDER_EMAIL=""):
            self.assertFalse(email_delivery_configured())

    @patch("accounts.email_delivery.build")
    def test_transactional_email_uses_gmail_api_and_correct_message(self, build):
        execute = build.return_value.users.return_value.messages.return_value.send.return_value.execute
        execute.return_value = {"id": "gmail-message-id"}

        result = send_transactional_email(
            subject="Verification code",
            message="Your code is 123456.",
            recipient="user@example.com",
        )

        self.assertEqual(result, 1)
        build.assert_called_once()
        arguments = build.call_args.kwargs
        self.assertEqual(build.call_args.args, ("gmail", "v1"))
        self.assertFalse(arguments["cache_discovery"])
        self.assertEqual(arguments["credentials"].scopes, [GMAIL_SEND_SCOPE])
        send = build.return_value.users.return_value.messages.return_value.send
        send.assert_called_once()
        self.assertEqual(send.call_args.kwargs["userId"], "me")

        encoded = send.call_args.kwargs["body"]["raw"]
        decoded = base64.urlsafe_b64decode(encoded.encode("ascii"))
        email = message_from_bytes(decoded, policy=default)
        self.assertEqual(email["From"], "sender@gmail.com")
        self.assertEqual(email["To"], "user@example.com")
        self.assertEqual(email["Subject"], "Verification code")
        self.assertEqual(email.get_content().strip(), "Your code is 123456.")

    @patch("accounts.email_delivery.build")
    def test_transactional_email_fails_if_gmail_api_does_not_confirm_send(self, build):
        execute = build.return_value.users.return_value.messages.return_value.send.return_value.execute
        execute.return_value = {}

        with self.assertRaisesMessage(RuntimeError, "did not confirm"):
            send_transactional_email(
                subject="Verification code",
                message="Your code is 123456.",
                recipient="user@example.com",
            )
