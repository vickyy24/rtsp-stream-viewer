import { useEffect, useRef, useState } from "react";
import { LuExpand, LuPause, LuPlay } from "react-icons/lu";
import CameraIcon from "./CameraIcon.jsx";
import { getAuthToken, getStreamSocketUrl } from "../services/streamService.js";

export default function StreamCard({ stream, index, isSelected, isFullscreen, onFrame, onSelect, onStatusChange, onRetry, onToggle }) {
    const [status, setStatus] = useState(stream.playing ? "connecting" : "paused");
    const [frameUrl, setFrameUrl] = useState("");
    const [message, setMessage] = useState("");
    const previewRef = useRef(null);

    async function togglePreviewFullscreen() {
        if (document.fullscreenElement === previewRef.current) {
            await document.exitFullscreen();
            return;
        }
        if (document.fullscreenElement) await document.exitFullscreen();
        await previewRef.current?.requestFullscreen();
    }

    useEffect(() => {
        if (!stream.playing) {
            setStatus("paused");
            setMessage("");
            onStatusChange(stream.id, "paused");
            return undefined;
        }

        let currentFrameUrl = "";
        let closeRequested = false;
        let errorReported = false;
        let keepAliveInterval;
        const sessionSocket = stream.session?.take();
        const activeSession = sessionSocket ? stream.session : null;
        const socket = sessionSocket || new WebSocket(getStreamSocketUrl());
        socket.binaryType = "blob";
        setStatus(activeSession ? "live" : "connecting");
        setMessage("");
        onStatusChange(stream.id, activeSession ? "live" : "connecting");

        function startKeepAlive() {
            if (keepAliveInterval) return;
            keepAliveInterval = window.setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: "ping" }));
                }
            }, 5 * 60 * 1000);
        }

        socket.onopen = () => {
            if (closeRequested) return;
            if (activeSession) startKeepAlive();
        };
        if (activeSession && socket.readyState === WebSocket.OPEN) startKeepAlive();
        socket.onmessage = (event) => {
            if (closeRequested) return;
            if (typeof event.data !== "string") {
                onFrame(stream.id, event.data);
                const nextUrl = URL.createObjectURL(event.data);
                if (currentFrameUrl) URL.revokeObjectURL(currentFrameUrl);
                currentFrameUrl = nextUrl;
                setFrameUrl(nextUrl);
                return;
            }

            let payload;
            try {
                payload = JSON.parse(event.data);
            } catch {
                return;
            }
            if (payload.type === "ready") {
                socket.send(JSON.stringify({ type: "auth", token: getAuthToken() }));
            } else if (payload.type === "authenticated") {
                socket.send(JSON.stringify({ type: "start", camera_id: stream.id }));
                startKeepAlive();
            } else if (payload.type === "status") {
                setStatus(payload.status);
                onStatusChange(stream.id, payload.status);
            } else if (payload.type === "error") {
                errorReported = true;
                window.clearInterval(keepAliveInterval);
                setStatus("error");
                setMessage(payload.message || "The camera could not be reached.");
                onStatusChange(stream.id, "error");
            }
        };
        socket.onerror = () => {
            if (closeRequested) return;
            errorReported = true;
            window.clearInterval(keepAliveInterval);
            setStatus("error");
            setMessage("Could not reach the stream service. Check that the backend is running.");
            onStatusChange(stream.id, "error");
        };
        socket.onclose = () => {
            window.clearInterval(keepAliveInterval);
            if (!closeRequested && !errorReported) {
                setStatus("error");
                setMessage("The connection to the camera service was closed.");
                onStatusChange(stream.id, "error");
            }
        };

        return () => {
            closeRequested = true;
            window.clearInterval(keepAliveInterval);
            if (activeSession) {
                activeSession.release();
            } else if (socket.readyState < WebSocket.CLOSING) {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: "stop" }));
                }
                socket.close();
            }
            if (currentFrameUrl) URL.revokeObjectURL(currentFrameUrl);
            setFrameUrl("");
        };
    }, [onFrame, onStatusChange, stream.id, stream.playing, stream.retryCount, stream.session]);

    const statusLabel = {
        connecting: "Connecting",
        live: "Live",
        error: "Connection issue",
        paused: "Paused",
        stopped: "Paused",
    }[status] || "Connecting";

    return (
        <article className={`${isFullscreen ? "flex h-full min-h-0 flex-col" : ""} overflow-hidden rounded-xl border bg-[var(--color-surface)] transition-colors ${isSelected
            ? "border-[var(--color-olive-600)] ring-1 ring-[var(--color-olive-600)]"
            : "border-stone-200/80"
            }`}>
            <div
                className={`camera-preview group relative flex w-full items-center justify-center overflow-hidden bg-stone-900 text-left ${isFullscreen ? "min-h-0 flex-1 aspect-auto" : "aspect-[3/2]"}`}
                ref={previewRef}
            >
                <button
                    aria-label={`Select ${stream.name || `camera ${index + 1}`}`}
                    aria-pressed={isSelected}
                    className="absolute inset-0 z-0 flex items-center justify-center text-left"
                    onClick={onSelect}
                    type="button"
                >
                    {frameUrl ? (
                        <img
                            alt={`Live feed from ${stream.name || `camera ${index + 1}`}`}
                            className="size-full object-cover"
                            src={frameUrl}
                        />
                    ) : (
                        <span className="flex max-w-sm flex-col items-center px-5 text-center text-white/55">
                            <CameraIcon className="size-9" />
                            <span className="mt-3 max-w-xs text-xs font-medium leading-5 text-white/75">
                                {message || (status === "connecting" ? "Connecting to camera…" : status === "error" ? "Camera connection failed" : "Camera paused")}
                            </span>
                        </span>
                    )}
                </button>
                <span className={`pointer-events-none absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide sm:left-3 sm:top-3 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-xs ${status === "live"
                    ? "bg-black/75 text-[var(--color-olive-500)]"
                    : status === "error"
                        ? "bg-rose-950/90 text-rose-200"
                        : "bg-black/70 text-white"
                    }`}>
                    <span className={`size-2 rounded-full ${status === "live" ? "bg-[var(--color-olive-500)]" : status === "error" ? "bg-rose-400" : "bg-stone-300"}`} />
                    {statusLabel}
                </span>
                <span className="pointer-events-none absolute right-3 top-3 z-10 hidden rounded-md bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white sm:block">
                    {new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date())}
                </span>
                {frameUrl && status === "error" && message && (
                    <span className="pointer-events-none absolute inset-x-3 top-14 z-10 mx-auto max-w-lg rounded-lg bg-rose-950/90 px-3 py-2 text-center text-xs font-medium leading-5 text-rose-100 shadow-lg">
                        {message}
                    </span>
                )}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-2 pt-8 text-white sm:gap-3 sm:px-4 sm:pb-3 sm:pt-12">
                    <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold uppercase leading-4 tracking-wide sm:text-sm">
                            <span className="hidden sm:inline">CAM {String(index + 1).padStart(2, "0")} / </span>{stream.name || `Camera ${String(index + 1).padStart(2, "0")}`}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] leading-3 text-white/85 sm:mt-1 sm:text-xs sm:leading-normal">
                            {stream.location || "Live feed"}
                        </span>
                    </span>
                    <span aria-hidden="true" className="hidden h-6 shrink-0 items-end gap-1 pr-14 sm:flex">
                        {[9, 14, 20].map((height) => (
                            <span className={`w-1.5 rounded-t-sm ${status === "live" ? "bg-[var(--color-olive-500)]" : "bg-white/40"}`} key={height} style={{ height }} />
                        ))}
                    </span>
                </span>
                <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5">
                    {status === "error" && (
                        <button
                            aria-label={`Retry camera ${index + 1}`}
                            className="rounded-md bg-black/75 px-2.5 py-1.5 text-sm font-semibold text-white transition hover:bg-black"
                            onClick={onRetry}
                            type="button"
                        >
                            Retry
                        </button>
                    )}
                </div>
                <button
                    aria-label={`${stream.playing ? "Pause" : "Play"} ${stream.name || `camera ${index + 1}`}`}
                    className="absolute bottom-3 right-12 z-20 flex size-8 items-center justify-center rounded-md bg-black/60 text-white transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggle();
                    }}
                    type="button"
                >
                    {stream.playing
                        ? <LuPause aria-hidden="true" className="size-4" />
                        : <LuPlay aria-hidden="true" className="size-4" />}
                </button>
                <button
                    aria-label="Toggle fullscreen for this camera"
                    className="absolute bottom-3 right-3 z-20 flex size-8 items-center justify-center rounded-md bg-black/60 text-white transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    onClick={togglePreviewFullscreen}
                    type="button"
                >
                    <LuExpand aria-hidden="true" className="size-4" />
                </button>
            </div>
        </article>
    );
}
