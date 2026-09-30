import sys
from unittest.mock import AsyncMock, patch

from asgiref.sync import async_to_sync
from django.test import SimpleTestCase, override_settings

from .consumers import validate_stream_url
from .ffmpeg import (
    InvalidStreamUrl,
    MjpegFrameReader,
    build_ffmpeg_command,
    extract_jpeg_frames,
    start_ffmpeg,
)


class StreamUrlTests(SimpleTestCase):
    def test_accepts_rtsp_url_with_credentials(self):
        stream_url = "rtsp://camera-user:camera-pass@example.test:554/live"

        self.assertEqual(validate_stream_url(stream_url), stream_url)

    def test_accepts_secure_rtsp_scheme(self):
        stream_url = "rtsps://camera.example.test/live"

        self.assertEqual(validate_stream_url(stream_url), stream_url)

    def test_rejects_unsupported_schemes(self):
        for stream_url in (
            "http://camera.example.test/live",
            "file:///etc/passwd",
            "rtsp:///missing-host",
        ):
            with self.subTest(stream_url=stream_url):
                with self.assertRaises(InvalidStreamUrl):
                    validate_stream_url(stream_url)

    def test_rejects_malformed_and_oversized_urls(self):
        for stream_url in (
            "rtsp://camera.example.test:invalid/live",
            "rtsp://camera.example.test/" + "x" * 2050,
            "rtsp://camera.example.test/live\r\nX-Injected: true",
        ):
            with self.subTest(stream_url=stream_url[:40]):
                with self.assertRaises(InvalidStreamUrl):
                    validate_stream_url(stream_url)


class FfmpegTests(SimpleTestCase):
    @override_settings(FFMPEG_BINARY="ffmpeg-custom")
    def test_builds_argument_list_without_shell_interpolation(self):
        command = build_ffmpeg_command("rtsp://camera.example.test/live")

        self.assertEqual(command[0], "ffmpeg-custom")
        self.assertIn("-protocol_whitelist", command)
        self.assertIn("-rtsp_transport", command)
        self.assertIn("image2pipe", command)
        self.assertNotIn("shell", command)

    def test_extracts_concatenated_jpegs_and_keeps_partial_marker(self):
        first_frame = b"\xff\xd8first\xff\xd9"
        second_frame = b"\xff\xd8second\xff\xd9"
        buffer = bytearray(b"noise" + first_frame + second_frame[:5])

        frames = extract_jpeg_frames(buffer)

        self.assertEqual(frames, [first_frame])
        self.assertEqual(buffer, bytearray(second_frame[:5]))

    def test_frame_reader_handles_chunk_boundaries(self):
        class FakeReader:
            def __init__(self):
                self.chunks = iter((b"noise\xff", b"\xd8frame\xff\xd9"))

            async def read(self, _size):
                return next(self.chunks, b"")

        frame_reader = MjpegFrameReader(FakeReader())
        frame = async_to_sync(frame_reader.read_frame)()

        self.assertEqual(frame, b"\xff\xd8frame\xff\xd9")

    def test_process_adapter_forwards_frames_from_a_real_child_process(self):
        frame = b"\xff\xd8process-frame\xff\xd9"

        async def exercise_process():
            process = await start_ffmpeg(
                [
                    sys.executable,
                    "-c",
                    "import sys; sys.stdout.buffer.write(bytes.fromhex('"
                    + frame.hex()
                    + "'))",
                ]
            )
            received_frame = await MjpegFrameReader(process.stdout).read_frame()
            await process.wait()
            if hasattr(process, "close"):
                process.close()
            return received_frame

        self.assertEqual(async_to_sync(exercise_process)(), frame)


class StreamConsumerTests(SimpleTestCase):
    @override_settings(DEBUG=False, STREAM_ACCESS_KEY="test-workspace-key")
    def test_production_streams_require_the_workspace_key(self):
        from channels.testing import WebsocketCommunicator
        from config.asgi import application

        async def exercise_connection():
            communicator = WebsocketCommunicator(
                application,
                "/ws/streams/",
                headers=[(b"origin", b"http://127.0.0.1:5173")],
            )
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            ready = await communicator.receive_json_from(timeout=1)
            await communicator.send_json_to(
                {"type": "start", "url": "rtsp://camera.example.test/live"}
            )
            rejected = await communicator.receive_json_from(timeout=1)
            await communicator.send_json_to(
                {"type": "authenticate", "key": "wrong-key"}
            )
            invalid_key = await communicator.receive_json_from(timeout=1)
            await communicator.send_json_to(
                {"type": "authenticate", "key": "test-workspace-key"}
            )
            accepted = await communicator.receive_json_from(timeout=1)
            await communicator.disconnect()
            return ready, rejected, invalid_key, accepted

        ready, rejected, invalid_key, accepted = async_to_sync(exercise_connection)()

        self.assertEqual(ready["type"], "ready")
        self.assertEqual(rejected["type"], "error")
        self.assertIn("Authenticate", rejected["message"])
        self.assertEqual(invalid_key["type"], "error")
        self.assertEqual(accepted["type"], "authenticated")

    @override_settings(DEBUG=True, STREAM_ACCESS_KEY="")
    def test_invalid_start_message_returns_a_safe_error(self):
        from channels.testing import WebsocketCommunicator
        from config.asgi import application

        async def exercise_connection():
            communicator = WebsocketCommunicator(
                application,
                "/ws/streams/",
                headers=[(b"origin", b"http://127.0.0.1:5173")],
            )
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            ready = await communicator.receive_json_from(timeout=1)
            await communicator.send_json_to({"type": "ping"})
            pong = await communicator.receive_json_from(timeout=1)
            await communicator.send_json_to(
                {"type": "start", "url": "https://example.test/camera"}
            )
            response = await communicator.receive_json_from(timeout=1)
            await communicator.disconnect()
            return ready, pong, response

        ready, pong, response = async_to_sync(exercise_connection)()

        self.assertEqual(ready["type"], "ready")
        self.assertEqual(pong["type"], "pong")
        self.assertEqual(response["type"], "error")
        self.assertIn("RTSP", response["message"])

    @override_settings(DEBUG=True, STREAM_ACCESS_KEY="")
    def test_start_stream_forwards_binary_video_and_lifecycle_events(self):
        from channels.testing import WebsocketCommunicator
        from config.asgi import application

        frame = b"\xff\xd8test-frame\xff\xd9"

        class FakeReader:
            def __init__(self, chunks):
                self.chunks = iter(chunks)

            async def read(self, _size):
                return next(self.chunks, b"")

        class FakeProcess:
            returncode = 0

            def __init__(self):
                self.stdout = FakeReader((frame,))
                self.stderr = FakeReader(())
                self.wait = AsyncMock(return_value=0)

        fake_process = FakeProcess()

        async def exercise_connection():
            communicator = WebsocketCommunicator(
                application,
                "/ws/streams/",
                headers=[(b"origin", b"http://127.0.0.1:5173")],
            )
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            await communicator.receive_json_from(timeout=1)
            await communicator.send_json_to(
                {"type": "start", "url": "rtsp://camera.example.test/live"}
            )
            connecting = await communicator.receive_json_from(timeout=1)
            first_frame = await communicator.receive_from(timeout=1)
            live = await communicator.receive_json_from(timeout=1)
            error = await communicator.receive_json_from(timeout=1)
            await communicator.disconnect()
            return connecting, first_frame, live, error

        with patch(
            "streams.consumers.start_ffmpeg",
            new=AsyncMock(return_value=fake_process),
        ):
            connecting, first_frame, live, error = async_to_sync(exercise_connection)()

        self.assertEqual(connecting["status"], "connecting")
        self.assertEqual(first_frame, frame)
        self.assertEqual(live["status"], "live")
        self.assertEqual(error["type"], "error")
        self.assertNotIn("camera.example.test", error["message"])
