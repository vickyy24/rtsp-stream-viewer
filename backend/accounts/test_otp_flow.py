import hashlib
import hmac
import json
import uuid
from contextlib import nullcontext
from unittest.mock import Mock, patch

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.db import IntegrityError
from django.test import SimpleTestCase, override_settings

from .api import SIGNUP_TOKEN_SALT, _signup_cache_key, _signup_token_cipher
from .models import User


@override_settings(
    MAILJET_API_KEY="mailjet-api-key",
    MAILJET_SECRET_KEY="mailjet-secret-key",
    MAILJET_FROM_EMAIL="verified@example.com",
    MAILJET_FROM_NAME="Signal",
)
class SignupOtpFlowTests(SimpleTestCase):
    def setUp(self):
        self.email = f"{uuid.uuid4().hex}@example.com"
        self.send_key = _signup_cache_key("send", self.email)
        self.active_key = _signup_cache_key("active", self.email)
        self.addCleanup(cache.delete, self.send_key)
        self.addCleanup(cache.delete, self.active_key)

    def test_signup_sends_generated_code_to_user_and_verifies_it_once(self):
        existing_users = Mock()
        existing_users.exists.return_value = False
        sent_emails = []
        with (
            patch.object(User.objects, "filter", return_value=existing_users),
            patch(
                "accounts.api.send_otp_email",
                side_effect=lambda recipient, otp: sent_emails.append((recipient, otp)),
            ),
        ):
            signup_response = self.client.post(
                "/api/auth/signup/",
                data=json.dumps(
                    {
                        "full_name": "Example User",
                        "email": self.email,
                        "password": "a-long-test-password",
                    }
                ),
                content_type="application/json",
            )

        self.assertEqual(signup_response.status_code, 202)
        self.assertEqual(len(sent_emails), 1)
        recipient, otp = sent_emails[0]
        self.assertEqual(recipient, self.email)
        self.assertRegex(otp, r"^\d{6}$")
        signup_body = json.loads(signup_response.content)
        self.assertNotIn(otp, signup_response.content.decode("utf-8"))

        invalid_response = self.client.post(
            "/api/auth/verify-email/",
            data=json.dumps(
                {
                    "email": self.email,
                    "code": "000000" if otp != "000000" else "000001",
                    "challenge_token": signup_body["challenge_token"],
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(invalid_response.status_code, 400)

        user = Mock(pk=42, email=self.email, full_name="Example User")
        user.save.side_effect = [None, IntegrityError("duplicate account")]
        with (
            patch("accounts.api.User", return_value=user),
            patch("accounts.api.transaction.atomic", return_value=nullcontext()),
            patch("accounts.api.create_access_token", return_value="application-token"),
        ):
            verified_response = self.client.post(
                "/api/auth/verify-email/",
                data=json.dumps(
                    {
                        "email": self.email,
                        "code": otp,
                        "challenge_token": signup_body["challenge_token"],
                    }
                ),
                content_type="application/json",
            )
            replay_response = self.client.post(
                "/api/auth/verify-email/",
                data=json.dumps(
                    {
                        "email": self.email,
                        "code": otp,
                        "challenge_token": signup_body["challenge_token"],
                    }
                ),
                content_type="application/json",
            )

        self.assertEqual(verified_response.status_code, 200)
        self.assertEqual(json.loads(verified_response.content)["token"], "application-token")
        self.assertEqual(replay_response.status_code, 409)

    def test_expired_signup_code_is_rejected(self):
        otp = "123456"
        code_hash = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            f"{self.email}:{otp}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        challenge = {
            "id": "expired-challenge",
            "email": self.email,
            "full_name": "Example User",
            "password_hash": "hashed-password",
            "code_hash": code_hash,
        }
        with patch("django.core.signing.time.time", return_value=1):
            signed_challenge = signing.dumps(
                challenge,
                salt=SIGNUP_TOKEN_SALT,
                compress=True,
            )
        challenge_token = _signup_token_cipher().encrypt(
            signed_challenge.encode("utf-8")
        ).decode("ascii")

        response = self.client.post(
            "/api/auth/verify-email/",
            data=json.dumps(
                {
                    "email": self.email,
                    "code": otp,
                    "challenge_token": challenge_token,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("expired", json.loads(response.content)["error"].lower())
