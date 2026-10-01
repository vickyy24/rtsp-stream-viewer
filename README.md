# RTSP Stream Viewer

A responsive web application for viewing one or more RTSP camera feeds in a browser. The project uses React for the client and Django, Django Channels, WebSockets, and FFmpeg for stream processing.

## Project status

The React workspace saves camera records through an authenticated Django API. Django encrypts each RTSP URL before storing it, returns only safe camera metadata to the browser, and resolves saved cameras by ID when a Channels WebSocket asks to stream. FFmpeg runs on the backend and sends JPEG frames to the browser. Individual user accounts and video recording are not implemented; cameras are shared within one workspace protected by a workspace key.

## Technology

- Frontend: React, Vite, Tailwind CSS
- Backend: Django, Django Channels, ASGI
- Media processing: FFmpeg
- Frontend deployment target: Vercel
- Backend deployment: a separately hosted ASGI service
- Database: SQLite for local development, PostgreSQL for hosted deployments
- Camera URL encryption: AES-GCM with a separately configured key

## Repository layout

```text
frontend/
  src/
    components/ Reusable camera, navigation, header, and grid components
    views/      Dashboard, camera wizard, archive, layout, settings, and connection screens
    services/   WebSocket connection helpers
    App.jsx     Workspace state and view composition
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

When `DJANGO_DEBUG=true` and no local `.env` exists, Django loads the development values from `backend/.env.example`. Local development defaults to `backend/db.sqlite3`; this ignored SQLite file is the actual local camera database, created by `migrate`. Hosted deployments use PostgreSQL through `DATABASE_URL` and run migrations at container startup. Install FFmpeg and make it available on `PATH` (or set `FFMPEG_BINARY` to its executable path). Set unique `DJANGO_SECRET_KEY`, `STREAM_ACCESS_KEY`, and `CAMERA_URL_ENCRYPTION_KEY` values before exposing the service. Production reads these from hosting environment variables and does not load the development example.

On Windows, FFmpeg can be installed with `winget install --id Gyan.FFmpeg.Shared --exact --source winget`. On macOS use `brew install ffmpeg`; on Debian/Ubuntu use `sudo apt-get install ffmpeg`. Start Daphne for local development because Django's default development server does not serve this Channels WebSocket endpoint.

## Environment variables

Backend configuration is read from environment variables. [`backend/.env.example`](backend/.env.example) contains local development settings. Production requires `DJANGO_SECRET_KEY`, `STREAM_ACCESS_KEY`, `CAMERA_URL_ENCRYPTION_KEY`, and `DATABASE_URL`; the Render Blueprint generates the keys and connects the Postgres database. `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` must match the deployed hosts. `DJANGO_SECURE_SSL_REDIRECT` enables app-level HTTPS redirects when the hosting proxy does not provide them. `FFMPEG_BINARY` selects the FFmpeg executable, and `RTSP_MAX_CONCURRENT_STREAMS` limits per-process FFmpeg work. Never commit production secrets or credential-bearing RTSP URLs.

## API and stream flow

The backend exposes these endpoints:

- `GET /health/` is a small HTTP health check used by Render.
- `GET /api/cameras/` lists saved camera metadata; it never returns camera URLs.
- `POST /api/cameras/` validates and stores a camera URL encrypted in the database. The URL is sent once over HTTPS from the wizard and is not included in the response.
- `DELETE /api/cameras/<camera-id>/` deletes a saved camera.
- `WS /ws/streams/` is the real-time streaming API. Use `ws://127.0.0.1:8000/ws/streams/` locally and `wss://<render-service-host>/ws/streams/` after deployment.

HTTP camera operations use `Authorization: Bearer <workspace-key>`. The browser keeps that workspace key in the current tab's `sessionStorage` so a page refresh can reconnect without asking again. Each stream socket authenticates with the same key, then sends `{"type":"start","camera_id":"<uuid>"}`. Django looks up and decrypts the RTSP URL on the server, starts FFmpeg, and returns JPEG frames as binary WebSocket messages with JSON status/error messages. A camera's host/name/location are returned as metadata; its full URL and token are never returned by list/create APIs. The backend limits active streams per process (default 4). The browser sends a keepalive every five minutes; the server replies with `pong`.

### Database responsibilities and setup

The database stores camera name, optional location, host, timestamps, and an encrypted RTSP URL. It is needed so a saved camera survives browser refresh and backend redeploy. SQLite is for local development only. Render Blueprint provisions a PostgreSQL database and provides its connection string as `DATABASE_URL`; the application applies schema migrations on container start. Keep `CAMERA_URL_ENCRYPTION_KEY` backed up in the deployment's secret manager: changing it without re-encrypting the saved camera URLs makes them unreadable. The API has no per-person login yet, so one workspace key currently grants access to the shared camera list. Add user accounts and per-user camera ownership before handing the application to multiple independent client users.

On a new deployment, connect the GitHub repository to Render as a Blueprint and deploy `render.yaml`; this creates the API service and Postgres instance. On Render, open the API service's Environment page and check that generated `STREAM_ACCESS_KEY` and `CAMERA_URL_ENCRYPTION_KEY` are set, and that `DATABASE_URL` is linked to the provisioned database. After the API is live, enter the shared access key in the masked field when adding a camera. For local development, the example key values are development-only and the access key can be blank.

**Free-tier database limitation:** Render states that free Postgres expires 30 days after creation, is limited to 1 GB, and has no backups. It can be used for the initial live preview, but it is not durable client storage. Upgrade the database to a paid Render Postgres plan before the 30-day expiry (or select a different durable database host), then verify a backup/export before handing the application to the client. [Render free instance and Postgres limits](https://render.com/docs/free).

## Deployment

### Frontend on Vercel

Create a Vercel project connected to this repository and set the project root to `frontend`. Use `npm run build` as the build command and `dist` as the output directory. Deploy once to receive the frontend's `vercel.app` origin. After deploying the backend, enter that exact frontend origin in Render's `CORS_ALLOWED_ORIGINS`. Set Vercel `VITE_API_URL` to the backend's HTTPS origin (for example, `https://your-backend-host`) and `VITE_STREAM_WS_URL` to its secure WebSocket URL ending in `/ws/streams/` (for example, `wss://your-backend-host/ws/streams/`), then redeploy.

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
- **Saved cameras do not load:** Check the API origin (`VITE_API_URL`), the tab's workspace key, Render `DATABASE_URL`, and backend logs for migration errors.
- **WebSocket connection failed:** Confirm the ASGI backend is running, the configured URL ends in `/ws/streams/`, and the frontend origin is in `CORS_ALLOWED_ORIGINS`.
- **Camera times out:** Confirm the backend host can reach the camera over RTSP/TCP; browser reachability does not imply backend reachability.
- **Unsupported deployment:** Use a host that supports persistent ASGI WebSockets, FFmpeg processes, and outbound RTSP. Frontend hosting alone cannot relay a camera stream.

## Assignment baseline

The supplied Skylark Labs specification calls for adding RTSP URLs, browser playback, simultaneous streams in a grid, play/pause controls, graceful connection error handling, React, Django, FFmpeg, and Django Channels/WebSockets. It also lists a public test stream containing credentials; that URL is intentionally not copied into this repository.
