# RTSP Stream Viewer

A responsive web application for viewing one or more RTSP camera feeds in a browser. The project uses React for the client and Django, Django Channels, WebSockets, and FFmpeg for stream processing.

## Project status

The React workspace saves camera records through the Django API. Django encrypts each RTSP URL before storing it, returns only safe camera metadata to the browser, and resolves saved cameras by ID when a Channels WebSocket asks to stream. FFmpeg runs on the backend and sends JPEG frames to the browser. User accounts and access control are not implemented; camera management and streams are public to visitors of the deployed application.

## Technology

- Frontend: React, Vite, Tailwind CSS
- Backend: Django, Django Channels, ASGI
- Media processing: FFmpeg
- Frontend deployment target: Vercel
- Backend deployment: a separately hosted ASGI service
- Database: PostgreSQL only (Neon for the deployed database)
- Camera URL encryption: AES-GCM with a separately configured key

## Repository layout

```text
frontend/
  src/
    app/        Route table and URL path constants
    components/ Reusable sidebar, header, stream, camera, and dashboard components
      layout/   Persistent application shell
      ui/       Shared button and card primitives
    views/      Dashboard, camera wizard, archive, layout, settings, and connection screens
    services/   API and WebSocket connection helpers
    App.jsx     Shared workspace state and stream lifecycle
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

The backend reads configuration from the single `backend/.env` file outside the hosting platform. Set a PostgreSQL connection URL in `DATABASE_URL`; PostgreSQL is required in every mode. The deployed Render service reads its environment variables, including `DATABASE_URL`, from the Render service configuration. Install FFmpeg and make it available on `PATH` (or set `FFMPEG_BINARY` to its executable path). Set unique `DJANGO_SECRET_KEY` and `CAMERA_URL_ENCRYPTION_KEY` values before exposing the service. Never commit `.env` or place production credentials in the repository.

On Windows, FFmpeg can be installed with `winget install --id Gyan.FFmpeg.Shared --exact --source winget`. On macOS use `brew install ffmpeg`; on Debian/Ubuntu use `sudo apt-get install ffmpeg`. Start Daphne for local development because Django's default development server does not serve this Channels WebSocket endpoint.

## Environment variables

Backend configuration is read from `backend/.env` outside the hosting platform and from Render's service environment in deployment. `DJANGO_SECRET_KEY`, `CAMERA_URL_ENCRYPTION_KEY`, and PostgreSQL `DATABASE_URL` are required. `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` must match the deployed hosts. `DJANGO_SECURE_SSL_REDIRECT` enables app-level HTTPS redirects when the hosting proxy does not provide them. `FFMPEG_BINARY` selects the FFmpeg executable, and `RTSP_MAX_CONCURRENT_STREAMS` limits per-process FFmpeg work. Never commit production secrets or credential-bearing RTSP URLs.

## API and stream flow

The backend exposes these endpoints:

- `GET /health/` is a small HTTP health check used by Render.
- `GET /api/cameras/` lists saved camera metadata; it never returns camera URLs.
- `POST /api/cameras/` validates and stores a camera URL encrypted in the database. The URL is sent once over HTTPS from the wizard and is not included in the response.
- `DELETE /api/cameras/<camera-id>/` deletes a saved camera.
- `WS /ws/streams/` is the real-time streaming API. Use `ws://127.0.0.1:8000/ws/streams/` locally and `wss://<render-service-host>/ws/streams/` after deployment.

HTTP camera operations are public. WebSocket clients send `{"type":"start","camera_id":"<uuid>"}` to view a saved stream. Django looks up and decrypts the RTSP URL on the server, starts FFmpeg, and returns JPEG frames as binary WebSocket messages with JSON status/error messages. A camera's host/name/location are returned as metadata; its full URL and token are never returned by list/create APIs. The backend limits active streams per process (default 4). The browser sends a keepalive every five minutes; the server replies with `pong`.

### Database responsibilities and setup

The PostgreSQL database stores camera name, optional location, host, timestamps, and an encrypted RTSP URL. It is needed so a saved camera survives browser refresh and backend redeploy. All Django ORM queries and schema migrations run against the PostgreSQL database configured by `DATABASE_URL`; the application rejects non-PostgreSQL URLs. The application applies schema migrations on container start. Keep `CAMERA_URL_ENCRYPTION_KEY` backed up in the deployment's secret manager: changing it without re-encrypting the saved camera URLs makes them unreadable. User accounts and per-user camera ownership are not implemented.

On Render, open the API service's Environment page and set `DATABASE_URL` to the Neon PostgreSQL connection string. Keep the value private and do not commit it. Confirm `CAMERA_URL_ENCRYPTION_KEY` is also present. The Blueprint declares `DATABASE_URL` as a manually supplied secret; it does not create or automatically link an external Neon database. Container startup applies migrations to this configured Neon database.

## Deployment

### Frontend on Vercel

Create a Vercel project connected to this repository and set the project root to `frontend`. Use `npm run build` as the build command and `dist` as the output directory. The frontend uses React Router paths (`/live`, `/cameras`, `/cameras/add`, `/layouts`, `/archive`, `/connections`, and `/settings`); `frontend/vercel.json` rewrites direct route requests to the SPA entry point so refreshing a nested URL works. Deploy once to receive the frontend's `vercel.app` origin. After deploying the backend, enter that exact frontend origin in Render's `CORS_ALLOWED_ORIGINS`. Set Vercel `VITE_API_URL` to the backend's HTTPS origin (for example, `https://your-backend-host`) and `VITE_STREAM_WS_URL` to its secure WebSocket URL ending in `/ws/streams/` (for example, `wss://your-backend-host/ws/streams/`), then redeploy.

### Backend

The root `render.yaml` and `backend/Dockerfile` configure a Render Docker web service with FFmpeg, Daphne, health check, generated Django/workspace/encryption keys, and a PostgreSQL connection. Container startup applies Django migrations before Daphne starts. Docker installs FFmpeg and runs Daphne as an ASGI server that supports HTTP and persistent WebSocket connections. Enter the Vercel origin in `CORS_ALLOWED_ORIGINS`. Render supplies `PORT`; the container binds Daphne to it. Configure both Vercel environment variables listed above. The in-memory Channels layer is suitable for a single service instance; choose a shared channel layer before scaling the backend to multiple instances.

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
- **Saved cameras do not load:** Check the API origin (`VITE_API_URL`), Render `DATABASE_URL`, and backend logs for migration errors.
- **WebSocket connection failed:** Confirm the ASGI backend is running, the configured URL ends in `/ws/streams/`, and the frontend origin is in `CORS_ALLOWED_ORIGINS`.
- **Camera times out:** Confirm the backend host can reach the camera over RTSP/TCP; browser reachability does not imply backend reachability.
- **Unsupported deployment:** Use a host that supports persistent ASGI WebSockets, FFmpeg processes, and outbound RTSP. Frontend hosting alone cannot relay a camera stream.

## Assignment baseline

The supplied Skylark Labs specification calls for adding RTSP URLs, browser playback, simultaneous streams in a grid, play/pause controls, graceful connection error handling, React, Django, FFmpeg, and Django Channels/WebSockets. It also lists a public test stream containing credentials; that URL is intentionally not copied into this repository.
