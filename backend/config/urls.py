from django.http import JsonResponse
from django.urls import path

from accounts.api import current_user, signin, signup, verify_email
from streams.api import camera_detail, cameras

def health_check(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("api/auth/signup/", signup, name="signup"),
    path("api/auth/signin/", signin, name="signin"),
    path("api/auth/verify-email/", verify_email, name="verify-email"),
    path("api/auth/me/", current_user, name="current-user"),
    path("api/cameras/", cameras, name="camera-list"),
    path("api/cameras/<uuid:camera_id>/", camera_detail, name="camera-detail"),
]
