import base64
import json
from io import BytesIO
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

from django.test import SimpleTestCase, override_settings

from .email_delivery import (
    EmailDeliveryUnavailable,
    MailjetDeliveryError,
    email_delivery_configured,
    send_otp_email,
)


MAILJET_SETTINGS = {
    "MAILJET_API_KEY": "mailjet-api-key",
    "MAILJET_SECRET_KEY": "mailjet-secret-key",
    "MAILJET_FROM_EMAIL": "verified@example.com",
    "MAILJET_FROM_NAME": "Signal",
}


@override_settings(**MAILJET_SETTINGS)
class MailjetEmailDeliveryTests(SimpleTestCase):
    def _response(self, body, status=200):
        response = Mock()
        response.status = status
        response.read.return_value = json.dumps(body).encode("utf-8")
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        return response

    def test_send_uses_mailjet_v31_sender_recipient_and_basic_auth(self):
        response = self._response({"Messages": [{"Status": "success"}]})
        with patch("accounts.email_delivery.urlopen", return_value=response) as urlopen:
            self.assertTrue(send_otp_email("user@example.com", "123456", "signup"))

        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.mailjet.com/v3.1/send")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.get_header("Content-type"), "application/json")
        auth = request.get_header("Authorization")
        self.assertTrue(auth.startswith("Basic "))
        self.assertEqual(
            base64.b64decode(auth.removeprefix("Basic ")).decode("utf-8"),
            "mailjet-api-key:mailjet-secret-key",
        )
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 10)

        payload = json.loads(request.data)
        message = payload["Messages"][0]
        self.assertEqual(
            message["From"],
            {"Email": "verified@example.com", "Name": "Signal"},
        )
        self.assertEqual(message["To"], [{"Email": "user@example.com"}])
        self.assertEqual(message["Subject"], "Verify your email to create your Signal account")
        self.assertIn("SIGNAL | RTSP STREAM VIEWER", message["TextPart"])
        self.assertIn("verify your email address", message["TextPart"])
        self.assertIn("finish creating your Signal account", message["TextPart"])
        self.assertIn("123456", message["TextPart"])
        self.assertIn("10 minutes", message["TextPart"])
        self.assertIn("never share this code", message["TextPart"].lower())
        self.assertIn("max-width:520px", message["HTMLPart"])
        self.assertIn("Finish creating your Signal account", message["HTMLPart"])
        self.assertIn("verify your email address", message["HTMLPart"])
        self.assertIn(">123456</span>", message["HTMLPart"])
        self.assertIn("expires in 10 minutes", message["HTMLPart"])
        self.assertIn("never ask you to share it", message["HTMLPart"])
        self.assertIn("background-color:#f3f5f2", message["HTMLPart"])

    def test_otp_is_escaped_in_html_email(self):
        response = self._response({"Messages": [{"Status": "success"}]})
        with patch("accounts.email_delivery.urlopen", return_value=response) as urlopen:
            send_otp_email("user@example.com", "<123456>", "signup")

        html_part = json.loads(urlopen.call_args.args[0].data)["Messages"][0]["HTMLPart"]
        self.assertIn("&lt;123456&gt;", html_part)
        self.assertNotIn("<123456>", html_part)

    def test_incomplete_configuration_disables_email_delivery(self):
        with override_settings(MAILJET_SECRET_KEY=""):
            self.assertFalse(email_delivery_configured())
            with self.assertRaises(EmailDeliveryUnavailable):
                send_otp_email("user@example.com", "123456", "signup")

    def test_mailjet_http_error_is_reported_without_response_body(self):
        error = HTTPError(
            "https://api.mailjet.com/v3.1/send",
            401,
            "Unauthorized",
            {},
            BytesIO(b'{"ErrorMessage":"private response"}'),
        )
        with patch("accounts.email_delivery.urlopen", side_effect=error):
            with self.assertRaisesMessage(MailjetDeliveryError, "HTTP 401") as raised:
                send_otp_email("user@example.com", "123456", "signup")

        self.assertNotIn("private response", str(raised.exception))
        self.assertNotIn("mailjet-secret-key", str(raised.exception))

    def test_timeout_and_connection_failures_are_reported(self):
        for failure in (TimeoutError(), URLError("connection refused")):
            with self.subTest(failure=type(failure).__name__):
                with patch("accounts.email_delivery.urlopen", side_effect=failure):
                    with self.assertRaises(MailjetDeliveryError):
                        send_otp_email("user@example.com", "123456", "signup")

    def test_invalid_mailjet_response_is_reported(self):
        response = self._response({"Messages": [{"Status": "error"}]})
        with patch("accounts.email_delivery.urlopen", return_value=response):
            with self.assertRaisesMessage(MailjetDeliveryError, "did not confirm"):
                send_otp_email("user@example.com", "123456", "signup")

        response = Mock()
        response.status = 200
        response.read.return_value = b"not-json"
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        with patch("accounts.email_delivery.urlopen", return_value=response):
            with self.assertRaisesMessage(MailjetDeliveryError, "invalid response"):
                send_otp_email("user@example.com", "123456", "signup")

    def test_password_reset_email_explains_its_purpose(self):
        response = self._response({"Messages": [{"Status": "success"}]})
        with patch("accounts.email_delivery.urlopen", return_value=response) as urlopen:
            send_otp_email("user@example.com", "123456", "password_reset")

        message = json.loads(urlopen.call_args.args[0].data)["Messages"][0]
        self.assertEqual(message["Subject"], "Your Signal password reset code")
        self.assertIn("reset the password for your Signal account", message["TextPart"])
        self.assertIn("Reset your Signal password", message["HTMLPart"])
