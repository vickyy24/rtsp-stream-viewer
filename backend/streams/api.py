import json
import logging

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .consumers import validate_stream_url
from .ffmpeg import InvalidStreamUrl
from .models import Camera

logger = logging.getLogger(__name__)
MAX_REQUEST_BYTES = 8192


def _read_payload(request):
    if len(request.body) > MAX_REQUEST_BYTES:
        return None
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


@csrf_exempt
@require_http_methods(["GET", "POST"])
def cameras(request):
    if request.method == "GET":
        return JsonResponse({"cameras": [camera.public_data() for camera in Camera.objects.order_by("created_at")]})

    payload = _read_payload(request)
    if payload is None:
        return JsonResponse({"error": "Send a valid JSON camera object."}, status=400)
    name = payload.get("name")
    location = payload.get("location", "")
    raw_url = payload.get("url")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
        return JsonResponse({"error": "Camera name must be between 1 and 120 characters."}, status=400)
    if not isinstance(location, str) or len(location.strip()) > 160:
        return JsonResponse({"error": "Camera location must be at most 160 characters."}, status=400)
    try:
        stream_url = validate_stream_url(raw_url)
    except InvalidStreamUrl:
        return JsonResponse({"error": "Enter a valid RTSP or RTSPS camera address."}, status=400)
    try:
        camera = Camera.create_with_url(
            camera_name=name.strip(),
            camera_location=location.strip(),
            url=stream_url,
        )
    except RuntimeError:
        logger.exception("Camera URL encryption is not configured")
        return JsonResponse({"error": "Camera storage is not configured on the server."}, status=503)
    return JsonResponse({"camera": camera.public_data()}, status=201)


@csrf_exempt
@require_http_methods(["DELETE"])
def camera_detail(request, camera_id):
    try:
        camera = Camera.objects.get(id=camera_id)
    except (Camera.DoesNotExist, ValueError):
        return JsonResponse({"error": "Camera was not found."}, status=404)
    camera.delete()
    return HttpResponse(status=204)
