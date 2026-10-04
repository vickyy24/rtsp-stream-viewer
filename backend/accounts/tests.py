import base64
from hashlib import sha256
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlsplit

from django.core import signing
from django.test import SimpleTestCase, override_settings

from accounts.api import (
    GOOGLE_OAUTH_COOKIE,
    GOOGLE_OAUTH_COOKIE_SALT,
)
from accounts.models import User


@override_settings(
    FRONTEND_URL="https://signal.example",
    GOOGLE_OAUTH_CLIENT_ID="client-id",
    GOOGLE_OAUTH_CLIENT_SECRET="client-secret",
    GOOGLE_OAUTH_REDIRECT_URI="https://api.example/api/auth/google/callback/",
)
class GoogleOAuthTests(SimpleTestCase):
    def test_start_redirects_with_state_and_pkce_and_sets_http_only_cookie(self):
        response = self.client.get("/api/auth/google/")

        self.assertEqual(response.status_code, 302)
        authorization = urlsplit(response["Location"])
        parameters = parse_qs(authorization.query)
        cookie = response.cookies[GOOGLE_OAUTH_COOKIE]
        session = signing.loads(cookie.value, salt=GOOGLE_OAUTH_COOKIE_SALT)
        expected_challenge = base64.urlsafe_b64encode(
            sha256(session["verifier"].encode("ascii")).digest()
        ).rstrip(b"=").decode("ascii")

        self.assertEqual(authorization.netloc, "accounts.google.com")
        self.assertEqual(parameters["state"], [session["state"]])
        self.assertEqual(parameters["code_challenge"], [expected_challenge])
        self.assertEqual(parameters["code_challenge_method"], ["S256"])
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Lax")

    @override_settings(GOOGLE_OAUTH_CLIENT_ID="", GOOGLE_OAUTH_CLIENT_SECRET="", GOOGLE_OAUTH_REDIRECT_URI="")
    def test_start_returns_to_signin_with_helpful_error_when_not_configured(self):
        response = self.client.get("/api/auth/google/")

        self.assertEqual(
            response["Location"],
            "https://signal.example/signin?oauthError=not-configured",
        )

    def test_callback_rejects_state_mismatch(self):
        response = self.client.get(
            "/api/auth/google/callback/?code=authorization-code&state=wrong-state"
        )

        self.assertEqual(
            response["Location"],
            "https://signal.example/signin?oauthError=invalid-state",
        )

    def test_callback_issues_app_token_for_verified_google_email(self):
        state = "verified-state"
        session_cookie = signing.dumps(
            {"state": state, "verifier": "pkce-verifier"},
            salt=GOOGLE_OAUTH_COOKIE_SALT,
        )
        user = Mock(spec=User, pk=42)
        query = Mock()
        query.first.return_value = user

        self.client.cookies[GOOGLE_OAUTH_COOKIE] = session_cookie
        with (
            patch("accounts.api._google_json_request", side_effect=[
                {"access_token": "provider-access-token"},
                {
                    "email": "user@example.com",
                    "email_verified": True,
                    "sub": "google-user-id",
                    "name": "Signal User",
                },
            ]) as google_request,
            patch.object(User.objects, "filter", return_value=query),
            patch("accounts.api.create_access_token", return_value="app-access-token"),
        ):
            response = self.client.get(
                f"/api/auth/google/callback/?code=authorization-code&state={state}"
            )

        self.assertEqual(
            response["Location"],
            "https://signal.example/signin#googleToken=app-access-token",
        )
        self.assertEqual(google_request.call_count, 2)
        self.assertEqual(response.cookies[GOOGLE_OAUTH_COOKIE]["max-age"], 0)

    def test_callback_rejects_unverified_google_email(self):
        state = "verified-state"
        self.client.cookies[GOOGLE_OAUTH_COOKIE] = signing.dumps(
            {"state": state, "verifier": "pkce-verifier"},
            salt=GOOGLE_OAUTH_COOKIE_SALT,
        )
        with (
            patch("accounts.api._google_json_request", side_effect=[
                {"access_token": "provider-access-token"},
                {
                    "email": "user@example.com",
                    "email_verified": False,
                    "sub": "google-user-id",
                },
            ]),
            patch.object(User.objects, "filter") as find_user,
        ):
            response = self.client.get(
                f"/api/auth/google/callback/?code=authorization-code&state={state}"
            )

        self.assertEqual(
            response["Location"],
            "https://signal.example/signin?oauthError=failed",
        )
        find_user.assert_not_called()
