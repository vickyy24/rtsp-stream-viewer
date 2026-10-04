from django.http import JsonResponse
from django.urls import path

from accounts.api import current_user, google_oauth_callback, google_oauth_start, request_password_reset, resend_signup_verification, reset_password, signin, signup, verify_email
from streams.api import camera_detail, cameras

def health_check(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("api/auth/signup/", signup, name="signup"),
    path("api/auth/signup/resend/", resend_signup_verification, name="signup-resend"),
    path("api/auth/signin/", signin, name="signin"),
    path("api/auth/google/", google_oauth_start, name="google-oauth-start"),
    path("api/auth/google/callback/", google_oauth_callback, name="google-oauth-callback"),
    path("api/auth/verify-email/", verify_email, name="verify-email"),
    path("api/auth/password-reset/request/", request_password_reset, name="password-reset-request"),
    path("api/auth/password-reset/confirm/", reset_password, name="password-reset-confirm"),
    path("api/auth/me/", current_user, name="current-user"),
    path("api/cameras/", cameras, name="camera-list"),
    path("api/cameras/<uuid:camera_id>/", camera_detail, name="camera-detail"),
]
