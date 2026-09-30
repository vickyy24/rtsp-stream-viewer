# RTSP Stream Viewer

A responsive web application for viewing one or more RTSP camera feeds in a browser. The project uses React for the client and Django, Django Channels, WebSockets, and FFmpeg for stream processing.

## Project status

This repository contains the initial project foundation. Stream ingestion, WebSocket delivery, and the multi-stream player will be implemented in later milestones.

## Technology

- Frontend: React, Vite, Tailwind CSS
- Backend: Django, Django Channels, ASGI
- Media processing: FFmpeg
- Frontend deployment target: Vercel
- Backend deployment: a separately hosted ASGI service

## Repository layout

```text
frontend/       React application
backend/        Django and Channels application
README.md       Project setup and operations guide
```

## Prerequisites

- Node.js 22 or newer and npm
- Python 3.12 or newer
- FFmpeg available on the backend host (required when stream processing is implemented)

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
Copy-Item .env.example .env
python manage.py migrate
python manage.py runserver
```

Set a unique `DJANGO_SECRET_KEY` in `backend/.env` before exposing the service. `.env` files are ignored by Git.

## Environment variables

Backend configuration is read from environment variables. See [`backend/.env.example`](backend/.env.example) for the local settings and defaults. Production secrets must be configured in the hosting platform, not committed to this repository.

## WebSockets and streaming

The backend is configured as an ASGI application with Django Channels. The WebSocket route and FFmpeg process manager will be added as part of the streaming implementation. RTSP credentials must remain on the backend and must never be placed in browser-visible configuration or logs.

## Deployment

### Frontend on Vercel

Create a Vercel project connected to this repository, set the project root to `frontend`, and use the Vite build command (`npm run build`) with `dist` as the output directory. Configure the production backend URL as a frontend environment variable when the API integration is introduced.

### Backend

Deploy `backend` as an ASGI application on a host that supports long-lived WebSocket connections and FFmpeg. Configure the environment variables from `.env.example`, set `DJANGO_DEBUG=false`, restrict `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`, and provide FFmpeg on the runtime image. A production channel layer will be selected with the backend hosting target; local in-memory channels are not suitable for multi-process production deployments.

### Future migration

The frontend and backend are independently deployable. Keep host-specific settings in environment variables so the backend can move to paid compute and a custom domain without changing the application structure.

## Development

- Use four spaces for Python, CSS, and JavaScript source indentation.
- Keep frontend and backend dependencies in their respective directories.
- Never commit credentials, `.env` files, or RTSP URLs containing credentials.
- Use the public sample RTSP URL from the assignment only for development, and do not make it a production default.

## Assignment baseline

The supplied Skylark Labs specification calls for adding RTSP URLs, browser playback, simultaneous streams in a grid, play/pause controls, graceful connection error handling, React, Django, FFmpeg, and Django Channels/WebSockets. It also lists a public test stream containing credentials; that URL is intentionally not copied into this repository.
