import { useEffect, useState } from "react";
import { LuPause, LuPlay, LuTrash2 } from "react-icons/lu";
import CameraIcon from "./CameraIcon.jsx";

export default function StreamCard({ stream, index, onStatusChange, onRetry, onToggle, onRemove }) {
    const [status, setStatus] = useState(stream.playing ? "connecting" : "paused");
    const [frameUrl, setFrameUrl] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!stream.playing) {
            setStatus("paused");
            setMessage("");
            return undefined;
        }

        let currentFrameUrl = "";
        let closeRequested = false;
        let errorReported = false;
        let keepAliveInterval;
        const configuredUrl = import.meta.env.VITE_STREAM_WS_URL;
        const socketUrl = configuredUrl || `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.hostname}:8000/ws/streams/`;
        const socket = new WebSocket(socketUrl);
        socket.binaryType = "blob";
        setStatus("connecting");
        setMessage("");
        onStatusChange(stream.id, "connecting");

        socket.onopen = () => {
            if (closeRequested) return;
            socket.send(JSON.stringify({ type: "authenticate", key: stream.accessKey }));
            keepAliveInterval = window.setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: "ping" }));
                }
            }, 5 * 60 * 1000);
        };
        socket.onmessage = (event) => {
            if (closeRequested) return;
            if (typeof event.data !== "string") {
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
            if (payload.type === "status") {
                setStatus(payload.status);
                onStatusChange(stream.id, payload.status);
            } else if (payload.type === "authenticated") {
                socket.send(JSON.stringify({ type: "start", url: stream.url }));
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
            if (currentFrameUrl) URL.revokeObjectURL(currentFrameUrl);
            if (!closeRequested && !errorReported) {
                setStatus("error");
                setMessage("The connection to the camera service was closed.");
                onStatusChange(stream.id, "error");
            }
        };

        return () => {
            closeRequested = true;
            window.clearInterval(keepAliveInterval);
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "stop" }));
            }
            socket.close();
            if (currentFrameUrl) URL.revokeObjectURL(currentFrameUrl);
            setFrameUrl("");
        };
    }, [stream.accessKey, stream.id, stream.playing, stream.retryCount, stream.url, onStatusChange]);

    const statusLabel = {
        connecting: "Connecting",
        live: "Live",
        error: "Connection issue",
        paused: "Paused",
        stopped: "Paused",
    }[status] || "Connecting";

    return (
        <article className="overflow-hidden rounded-2xl border border-stone-200 bg-[var(--color-surface)] shadow-sm shadow-stone-200/50">
            <div className="camera-preview relative flex aspect-video items-center justify-center bg-stone-100">
                {frameUrl && status === "live" ? (
                    <img
                        alt={`Live feed from camera ${index + 1}`}
                        className="size-full object-contain"
                        src={frameUrl}
                    />
                ) : (
                    <div className="flex max-w-sm flex-col items-center px-5 text-center text-stone-400">
                        <CameraIcon className="size-8" />
                        <span className="mt-3 max-w-xs text-xs font-medium leading-5">
                            {message || (status === "connecting" ? "Connecting to camera…" : status === "error" ? "Camera connection failed" : "Camera paused")}
                        </span>
                        {status === "error" && (
                            <button
                                className="mt-3 text-xs font-semibold text-[var(--color-forest-700)] hover:text-[var(--color-forest-900)]"
                                onClick={onRetry}
                                type="button"
                            >
                                Retry connection
                            </button>
                        )}
                    </div>
                )}
                <span className="absolute left-3 top-3 rounded-full border border-white/80 bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-semibold text-stone-600 shadow-sm">
                    CAMERA {String(index + 1).padStart(2, "0")}
                </span>
                <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-stone-200 bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-medium text-stone-500 shadow-sm">
                    <span
                        className={`size-1.5 rounded-full ${status === "live" ? "bg-[var(--color-olive-500)]" : status === "error" ? "bg-rose-500" : "bg-stone-400"}`}
                    />
                    {statusLabel}
                </span>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-stone-800">Camera {index + 1}</h3>
                    <p className="mt-0.5 truncate text-xs text-stone-400">{stream.host}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        aria-label={`${stream.playing ? "Pause" : "Play"} camera ${index + 1}`}
                        className="flex size-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-[var(--color-forest-50)] hover:text-[var(--color-forest-700)]"
                        onClick={onToggle}
                        type="button"
                    >
                        {stream.playing ? (
                            <LuPause aria-hidden="true" className="size-4" />
                        ) : (
                            <LuPlay aria-hidden="true" className="size-4" />
                        )}
                    </button>
                    <button
                        aria-label={`Remove camera ${index + 1}`}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                        onClick={onRemove}
                        type="button"
                    >
                        <LuTrash2 aria-hidden="true" className="size-4" />
                    </button>
                </div>
            </div>
        </article>
    );
}
