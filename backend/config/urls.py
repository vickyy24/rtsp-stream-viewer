from django.http import JsonResponse
from django.urls import path

from streams.api import camera_detail, cameras

def health_check(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("api/cameras/", cameras, name="camera-list"),
    path("api/cameras/<uuid:camera_id>/", camera_detail, name="camera-detail"),
]
