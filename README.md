# RTSP Stream Viewer

A responsive web application for viewing one or more RTSP camera feeds in a browser. The project uses React for the client and Django, Django Channels, WebSockets, and FFmpeg for stream processing.

## Project status

The React workspace accepts RTSP camera addresses and opens an independent Django Channels WebSocket for each camera. The backend launches a bounded FFmpeg process per active connection and forwards JPEG frames to the browser. Each tile includes play/pause, retry, remove, connecting/live/error states, and the grid adapts to screen size.

## Technology

- Frontend: React, Vite, Tailwind CSS
- Backend: Django, Django Channels, ASGI
- Media processing: FFmpeg
- Frontend deployment target: Vercel
- Backend deployment: a separately hosted ASGI service

## Repository layout

```text
frontend/
  src/
    components/ Reusable camera, navigation, form, summary, and grid components
    App.jsx      Workspace state and composition
backend/        Django and Channels application
README.md       Project setup and operations guide
```

## Prerequisites

- Node.js 22 or newer and npm
- Python 3.12 or newer
- FFmpeg available on the backend host

## Local setup

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Vite prints the local development URL after startup.

### Backend

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:DJANGO_DEBUG = "true"
python manage.py migrate
daphne --websocket-max-message-size 4096 -b 127.0.0.1 -p 8000 config.asgi:application
```

When `DJANGO_DEBUG=true` and no local `.env` exists, Django loads the development values from `backend/.env.example`. Install FFmpeg and make it available on `PATH` (or set `FFMPEG_BINARY` to its executable path). Set `DJANGO_SECRET_KEY` to a unique value before exposing the service. Production must provide its configuration through the hosting environment; it does not load the development example.

On Windows, FFmpeg can be installed with `winget install --id Gyan.FFmpeg.Shared --exact --source winget`. On macOS use `brew install ffmpeg`; on Debian/Ubuntu use `sudo apt-get install ffmpeg`. Start Daphne for local development because Django's default development server does not serve this Channels WebSocket endpoint.

## Environment variables

Backend configuration is read from environment variables. [`backend/.env.example`](backend/.env.example) contains local development settings and defaults. Production requires `DJANGO_SECRET_KEY` and `STREAM_ACCESS_KEY`; the Render Blueprint generates both. `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` must match the deployed hosts. `DJANGO_SECURE_SSL_REDIRECT` enables app-level HTTPS redirects when the hosting proxy does not provide them. `FFMPEG_BINARY` selects the FFmpeg executable, and `RTSP_MAX_CONCURRENT_STREAMS` limits per-process FFmpeg work. Never commit production secrets or credential-bearing RTSP URLs.

## WebSockets and streaming

The ASGI WebSocket endpoint is `/ws/streams/`. On connect the server sends a `ready` JSON event. The client first sends `{"type":"authenticate","key":"…"}` and then `{"type":"start","url":"rtsp://…"}` after the server confirms access. Production requires a `STREAM_ACCESS_KEY`; Render generates one from the Blueprint. Copy its value from the Render environment settings and enter it in the masked workspace-key field in the frontend. Local debug mode can run with an empty key. The server sends status/error JSON events and binary JPEG frames. The browser sends a small keepalive every five minutes while a stream is active; the server replies with `pong`. Send `{"type":"stop"}` or close the socket to terminate the FFmpeg process. The backend limits concurrent streams with `RTSP_MAX_CONCURRENT_STREAMS` (default 4); this is a per-process limit. Each active stream uses FFmpeg to transcode to reduced-resolution MJPEG frames, so provision compute for the expected camera count. RTSP URLs, including credentials, stay in frontend memory and are not persisted or included in logs; the backend uses argument-based process creation and does not echo the submitted URL. The access key is also kept in frontend memory and transmitted only over `wss://` in deployment.

## Deployment

### Frontend on Vercel

Create a Vercel project connected to this repository and set the project root to `frontend`. Use `npm run build` as the build command and `dist` as the output directory. Deploy once to receive the frontend's `vercel.app` origin. After deploying the backend, set the Vercel environment variable `VITE_STREAM_WS_URL` to the backend's secure WebSocket URL ending in `/ws/streams/` (for example, `wss://your-backend-host/ws/streams/`) and redeploy.

### Backend

The root `render.yaml` and `backend/Dockerfile` configure a Render Docker web service with FFmpeg, Daphne, a health check, generated Django and workspace access keys, and the free compute plan. Connect the GitHub repository to Render as a Blueprint. When prompted for `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`, enter the exact Vercel origin from the first frontend deploy (for example, `https://your-project.vercel.app`). Use the same value for both. Render supplies `PORT`; the container binds Daphne to it. Copy the generated `STREAM_ACCESS_KEY` from Render's environment settings; the site prompts for it in a masked field. The in-memory Channels layer is suitable for this single-instance demo service; choose a shared channel layer before scaling the backend to multiple instances.

The free Render service uses 0.1 CPU and 512 MB RAM, can spin down after 15 minutes without inbound traffic, has an ephemeral filesystem, and is restricted to one instance and 750 workspace hours per month. Render documents free instances as suitable for previews and hobby use, not production. CPU and memory may limit real-time decoding or multiple simultaneous cameras. Keep `RTSP_MAX_CONCURRENT_STREAMS` small on free compute; raise it only after moving to suitable capacity. A deployed RTSP source must permit outbound connections from the backend host.

### Future migration

The frontend and backend are independently deployable. Keep host-specific settings in environment variables so the backend can move to paid compute and a custom domain without changing the application structure.

## Development

- Use four spaces for Python, CSS, and JavaScript source indentation.
- Keep frontend and backend dependencies in their respective directories.
- Never commit credentials, `.env` files, or RTSP URLs containing credentials.
- Use the public sample RTSP URL from the assignment only for development, and do not make it a production default.

### Checks

```powershell
cd frontend
npm run build
cd ..\backend
$env:DJANGO_DEBUG = "true"
python manage.py check
python manage.py test streams
```

### Troubleshooting

- **FFmpeg unavailable:** Install FFmpeg on the backend host and verify `ffmpeg -version`, or set `FFMPEG_BINARY` to its full path.
- **WebSocket connection failed:** Confirm the ASGI backend is running, the configured URL ends in `/ws/streams/`, and the frontend origin is in `CORS_ALLOWED_ORIGINS`.
- **Camera times out:** Confirm the backend host can reach the camera over RTSP/TCP; browser reachability does not imply backend reachability.
- **Unsupported deployment:** Use a host that supports persistent ASGI WebSockets, FFmpeg processes, and outbound RTSP. Frontend hosting alone cannot relay a camera stream.

## Assignment baseline

The supplied Skylark Labs specification calls for adding RTSP URLs, browser playback, simultaneous streams in a grid, play/pause controls, graceful connection error handling, React, Django, FFmpeg, and Django Channels/WebSockets. It also lists a public test stream containing credentials; that URL is intentionally not copied into this repository.
