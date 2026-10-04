import asyncio
import json
import logging
from urllib.parse import urlsplit

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.conf import settings
from accounts.tokens import get_user_from_access_token

from .ffmpeg import (
    InvalidStreamUrl,
    MjpegFrameReader,
    StreamCapacity,
    build_ffmpeg_command,
    start_ffmpeg,
)
from .models import Camera

logger = logging.getLogger(__name__)
MAX_STREAM_URL_LENGTH = 2048
FIRST_FRAME_TIMEOUT_SECONDS = 20
FRAME_TIMEOUT_SECONDS = 15
PROCESS_STOP_TIMEOUT_SECONDS = 2
MAX_CONCURRENT_STREAMS = settings.RTSP_MAX_CONCURRENT_STREAMS
stream_capacity = StreamCapacity(MAX_CONCURRENT_STREAMS)


def validate_stream_url(stream_url):
    if not isinstance(stream_url, str):
        raise InvalidStreamUrl("A stream URL is required.")

    stream_url = stream_url.strip()
    if not stream_url or len(stream_url) > MAX_STREAM_URL_LENGTH:
        raise InvalidStreamUrl("The stream URL is empty or too long.")
    if any(ord(character) < 32 for character in stream_url):
        raise InvalidStreamUrl("The stream URL contains unsupported characters.")

    try:
        parsed_url = urlsplit(stream_url)
        hostname = parsed_url.hostname
        port = parsed_url.port
    except ValueError as error:
        raise InvalidStreamUrl("The stream URL is malformed.") from error

    if parsed_url.scheme.lower() not in {"rtsp", "rtsps"} or not hostname:
        raise InvalidStreamUrl("Only complete RTSP or RTSPS URLs are supported.")
    if port is not None and not 1 <= port <= 65535:
        raise InvalidStreamUrl("The RTSP port is invalid.")

    return stream_url


class StreamConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.process = None
        self.stderr_task = None
        self.frame_task = None
        self.stderr_tail = bytearray()
        self.process_lock = asyncio.Lock()
        self.capacity_acquired = False
        self.disconnecting = False
        self.stopping_stream = False
        self.user = None
        await self.accept()
        await self._send_event({"type": "ready"})

    async def receive(self, text_data=None, bytes_data=None):
        if text_data is None:
            await self._send_error("Send stream controls as JSON text messages.")
            return

        try:
            message = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            await self._send_error("The stream control message is not valid JSON.")
            return

        if not isinstance(message, dict):
            await self._send_error("The stream control message must be an object.")
            return

        if message.get("type") == "auth":
            await self._authenticate(message.get("token"))
        elif message.get("type") == "start":
            if message.get("camera_id"):
                await self._start_saved_camera(message.get("camera_id"))
            else:
                await self._start_stream(message.get("url"))
        elif message.get("type") == "stop":
            await self._stop_stream(notify=True)
        elif message.get("type") == "ping":
            await self._send_event({"type": "pong"})
        else:
            await self._send_error("Use a start, stop, or ping command.")

    async def disconnect(self, close_code):
        self.disconnecting = True
        await self._stop_stream(notify=False)

    async def _start_stream(self, raw_url):
        if self.user is None:
            await self._send_error("Sign in before opening a camera stream.")
            return
        if self.process is not None:
            await self._send_error("A camera is already running on this connection.")
            return

        try:
            stream_url = validate_stream_url(raw_url)
        except InvalidStreamUrl:
            await self._send_error("Enter a valid RTSP or RTSPS camera address.")
            return

        if not await stream_capacity.acquire():
            await self._send_event(
                {
                    "type": "error",
                    "message": "The server is at its stream limit. Close another camera and try again.",
                }
            )
            return
        self.capacity_acquired = True
        self.stderr_tail.clear()

        await self._send_event({"type": "status", "status": "connecting"})
        try:
            self.process = await start_ffmpeg(build_ffmpeg_command(stream_url))
        except FileNotFoundError:
            await self._release_capacity()
            await self._send_event(
                {
                    "type": "error",
                    "message": "FFmpeg is unavailable on the stream server.",
                }
            )
            return
        except OSError:
            await self._release_capacity()
            logger.exception("Unable to start the FFmpeg stream process")
            await self._send_error("The stream service could not start this camera.")
            return

        self.stderr_task = asyncio.create_task(self._drain_stderr(self.process.stderr))
        self.frame_task = asyncio.create_task(self._forward_frames())

    @database_sync_to_async
    def _resolve_user(self, token):
        return get_user_from_access_token(token) if isinstance(token, str) else None

    @database_sync_to_async
    def _load_camera_url(self, camera_id, user_id):
        try:
            camera = Camera.objects.get(pk=camera_id, owner_id=user_id)
            return camera.get_stream_url()
        except (Camera.DoesNotExist, ValueError, TypeError):
            return None

    async def _start_saved_camera(self, camera_id):
        if self.user is None:
            await self._send_error("Sign in before opening a camera stream.")
            return
        stream_url = await self._load_camera_url(camera_id, self.user.pk if self.user else None)
        if stream_url is None:
            await self._send_error("This saved camera could not be found or its URL is unavailable.")
            return
        await self._start_stream(stream_url)

    async def _authenticate(self, token):
        if self.user is not None:
            await self._send_error("This stream connection is already authenticated.")
            return
        self.user = await self._resolve_user(token)
        if self.user is None:
            await self._send_error("Sign in again to open camera streams.")
            return
        await self._send_event({"type": "authenticated"})

    async def _forward_frames(self):
        frame_reader = MjpegFrameReader(self.process.stdout)
        first_frame = True

        try:
            while not self.disconnecting and not self.stopping_stream:
                timeout = (
                    FIRST_FRAME_TIMEOUT_SECONDS
                    if first_frame
                    else FRAME_TIMEOUT_SECONDS
                )
                frame = await asyncio.wait_for(frame_reader.read_frame(), timeout)
                if frame is None:
                    if self.stderr_task:
                        try:
                            await asyncio.wait_for(
                                asyncio.shield(self.stderr_task),
                                PROCESS_STOP_TIMEOUT_SECONDS,
                            )
                        except asyncio.TimeoutError:
                            pass
                    await self._send_error(self._ffmpeg_failure_message())
                    return

                await self.send(bytes_data=frame)
                if first_frame:
                    first_frame = False
                    await self._send_event({"type": "status", "status": "live"})
        except asyncio.TimeoutError:
            await self._send_error(
                "No video arrived from the camera in time. Check its address and network access."
            )
        except asyncio.CancelledError:
            raise
        except (ConnectionError, OSError, RuntimeError) as error:
            if not self.disconnecting and not self.stopping_stream:
                logger.exception("The WebSocket stream delivery failed")
                await self._send_error(self._stream_interruption_message(error))
        finally:
            if not self.disconnecting and not self.stopping_stream:
                await self._stop_stream(notify=False)

    async def _drain_stderr(self, reader):
        while chunk := await reader.read(4096):
            self.stderr_tail.extend(chunk)
            if len(self.stderr_tail) > 16 * 1024:
                del self.stderr_tail[:-16 * 1024]

    def _ffmpeg_failure_message(self):
        diagnostics = self.stderr_tail.decode("utf-8", errors="replace").lower()
        if "401" in diagnostics and "unauthor" in diagnostics:
            return "The camera rejected the RTSP login (401 Unauthorized). Check the username and password in the RTSP address."
        if "403" in diagnostics or "forbidden" in diagnostics:
            return "The camera denied access (403 Forbidden). Check that this account is allowed to view the stream."
        if "404" in diagnostics or "not found" in diagnostics:
            return "The camera could not find that stream (404 Not Found). Check the RTSP path, including channel or profile."
        if "connection refused" in diagnostics:
            return "The camera refused the connection. Check its IP address, RTSP port (usually 554), and that RTSP is enabled."
        if any(term in diagnostics for term in ("timed out", "timeout", "network is unreachable", "no route to host")):
            return "The stream server could not reach the camera before the timeout. Check that the camera is online and that its RTSP port is reachable from the hosted server. Cameras available only on a private Wi-Fi network cannot be reached by the hosted app."
        if "connection reset" in diagnostics or "end of file" in diagnostics:
            return "The camera closed the RTSP connection before sending video. Check the stream path, login, and whether the camera allows another viewer."
        if "does not contain any stream" in diagnostics or "matches no streams" in diagnostics:
            return "The RTSP address opened, but it did not provide a video stream. Check the camera’s channel or profile path."
        return "The camera connection ended before video arrived. Check the RTSP address and make sure the camera is reachable from the hosted stream server."

    def _stream_interruption_message(self, error):
        if "payload limit" in str(error).lower() or "payloadexceedederror" in type(error).__name__.lower():
            return "The camera sent a video frame larger than the stream server allowed. The camera was reached, but the server rejected the frame. Please retry after the stream service update."
        diagnostics = self.stderr_tail.decode("utf-8", errors="replace").lower()
        if diagnostics:
            return self._ffmpeg_failure_message()
        return "The stream stopped before the test completed. Check that the camera stays online and that its RTSP address is reachable from the hosted server, then try again."

    async def _stop_stream(self, notify):
        self.stopping_stream = True
        frame_task = self.frame_task
        self.frame_task = None
        if frame_task and frame_task is not asyncio.current_task():
            frame_task.cancel()
            await asyncio.gather(frame_task, return_exceptions=True)

        async with self.process_lock:
            process = self.process
            self.process = None
            if process is not None:
                if process.returncode is None:
                    try:
                        process.terminate()
                        await asyncio.wait_for(
                            process.wait(), PROCESS_STOP_TIMEOUT_SECONDS
                        )
                    except asyncio.TimeoutError:
                        process.kill()
                        await process.wait()
                    except ProcessLookupError:
                        await process.wait()

            stderr_task = self.stderr_task
            self.stderr_task = None
            if stderr_task:
                try:
                    await asyncio.wait_for(stderr_task, PROCESS_STOP_TIMEOUT_SECONDS)
                except asyncio.TimeoutError:
                    stderr_task.cancel()
                    await asyncio.gather(stderr_task, return_exceptions=True)

            close_process_pipes = getattr(process, "close", None)
            if close_process_pipes:
                close_process_pipes()

            await self._release_capacity()

        self.stopping_stream = False
        if notify and not self.disconnecting:
            await self._send_event({"type": "status", "status": "stopped"})

    async def _release_capacity(self):
        if self.capacity_acquired:
            self.capacity_acquired = False
            await stream_capacity.release()

    async def _send_error(self, message):
        await self._send_event({"type": "error", "message": message})

    async def _send_event(self, event):
        if self.disconnecting:
            return
        try:
            await self.send(text_data=json.dumps(event))
        except (ConnectionError, RuntimeError):
            self.disconnecting = True
