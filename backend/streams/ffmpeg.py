import asyncio
import os
import subprocess

from django.conf import settings

MAX_JPEG_FRAME_BYTES = 2 * 1024 * 1024
READ_CHUNK_BYTES = 64 * 1024


class InvalidStreamUrl(ValueError):
    """Raised when a client submits a URL outside the supported RTSP formats."""


class ThreadedPipeReader:
    """Adapt blocking Windows pipe reads to the consumer's async frame reader."""

    def __init__(self, pipe):
        self.pipe = pipe

    async def read(self, size):
        return await asyncio.to_thread(self.pipe.read, size)


class ThreadedProcess:
    """Process adapter for Windows event loops without asyncio subprocess support."""

    def __init__(self, process):
        self.process = process
        self.stdout = ThreadedPipeReader(process.stdout)
        self.stderr = ThreadedPipeReader(process.stderr)

    @property
    def returncode(self):
        return self.process.returncode

    async def wait(self):
        return await asyncio.to_thread(self.process.wait)

    def terminate(self):
        self.process.terminate()

    def kill(self):
        self.process.kill()

    def close(self):
        self.process.stdout.close()
        self.process.stderr.close()


async def start_ffmpeg(command):
    """Start FFmpeg with an asyncio-native process where the loop supports it."""
    if os.name == "nt":
        process = await asyncio.to_thread(
            subprocess.Popen,
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0,
        )
        return ThreadedProcess(process)

    return await asyncio.create_subprocess_exec(
        *command,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )


def build_ffmpeg_command(stream_url):
    return [
        settings.FFMPEG_BINARY,
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "error",
        "-protocol_whitelist",
        "rtsp,tcp,tls,crypto",
        "-rtsp_transport",
        "tcp",
        "-rw_timeout",
        "10000000",
        "-i",
        stream_url,
        "-map",
        "0:v:0",
        "-an",
        "-vf",
        "fps=8,scale=960:-2",
        "-c:v",
        "mjpeg",
        "-q:v",
        "7",
        "-threads",
        "1",
        "-f",
        "image2pipe",
        "pipe:1",
    ]


def extract_jpeg_frames(buffer):
    """Extract complete JPEG frames in-place from FFmpeg's concatenated output."""
    frames = []

    while True:
        start = buffer.find(b"\xff\xd8")
        if start < 0:
            keep_final_marker_byte = buffer[-1:] == b"\xff"
            buffer[:] = b"\xff" if keep_final_marker_byte else b""
            break

        if start:
            del buffer[:start]

        end = buffer.find(b"\xff\xd9", 2)
        if end < 0:
            if len(buffer) > MAX_JPEG_FRAME_BYTES:
                del buffer[:2]
                continue
            break

        frame_end = end + 2
        if frame_end > MAX_JPEG_FRAME_BYTES:
            del buffer[:frame_end]
            continue

        frames.append(bytes(buffer[:frame_end]))
        del buffer[:frame_end]

    return frames


class MjpegFrameReader:
    def __init__(self, reader):
        self.reader = reader
        self.buffer = bytearray()
        self.frames = []

    async def read_frame(self):
        while not self.frames:
            chunk = await self.reader.read(READ_CHUNK_BYTES)
            if not chunk:
                return None
            self.buffer.extend(chunk)
            self.frames.extend(extract_jpeg_frames(self.buffer))

        return self.frames.pop(0)


class StreamCapacity:
    """Process-local limit to keep FFmpeg concurrency bounded."""

    def __init__(self, maximum):
        self.maximum = maximum
        self.active = 0
        self.lock = asyncio.Lock()

    async def acquire(self):
        async with self.lock:
            if self.active >= self.maximum:
                return False
            self.active += 1
            return True

    async def release(self):
        async with self.lock:
            self.active = max(0, self.active - 1)
