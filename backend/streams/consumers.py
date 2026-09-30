import asyncio
import hmac
import json
import logging
from urllib.parse import urlsplit

from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

from .ffmpeg import (
    InvalidStreamUrl,
    MjpegFrameReader,
    StreamCapacity,
    build_ffmpeg_command,
    start_ffmpeg,
)

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
        self.process_lock = asyncio.Lock()
        self.capacity_acquired = False
        self.disconnecting = False
        self.stopping_stream = False
        self.authenticated = settings.DEBUG and not settings.STREAM_ACCESS_KEY
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

        if message.get("type") == "authenticate":
            await self._authenticate(message.get("key"))
        elif message.get("type") == "start":
            if not self.authenticated:
                await self._send_error("Authenticate with the workspace key before starting a camera.")
                return
            await self._start_stream(message.get("url"))
        elif message.get("type") == "stop":
            await self._stop_stream(notify=True)
        elif message.get("type") == "ping":
            if self.authenticated:
                await self._send_event({"type": "pong"})
            else:
                await self._send_error("Authenticate with the workspace key first.")
        else:
            await self._send_error("Use an authenticate, start, or stop command.")

    async def _authenticate(self, provided_key):
        expected_key = settings.STREAM_ACCESS_KEY
        if not isinstance(provided_key, str):
            provided_key = ""
        self.authenticated = bool(expected_key) and hmac.compare_digest(
            provided_key,
            expected_key,
        )
        if settings.DEBUG and not expected_key and not provided_key:
            self.authenticated = True

        if self.authenticated:
            await self._send_event({"type": "authenticated"})
        else:
            await self._send_error("The workspace access key is invalid.")

    async def disconnect(self, close_code):
        self.disconnecting = True
        await self._stop_stream(notify=False)

    async def _start_stream(self, raw_url):
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
                    await self._send_error(
                        "The camera connection ended before video was received."
                    )
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
        except (ConnectionError, OSError, RuntimeError):
            if not self.disconnecting and not self.stopping_stream:
                logger.exception("The WebSocket stream delivery failed")
                await self._send_error("The camera stream was interrupted.")
        finally:
            if not self.disconnecting and not self.stopping_stream:
                await self._stop_stream(notify=False)

    async def _drain_stderr(self, reader):
        while await reader.read(4096):
            pass

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
