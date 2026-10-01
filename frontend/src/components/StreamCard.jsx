import { useEffect, useState } from "react";
import { LuPause, LuPlay, LuTrash2 } from "react-icons/lu";
import CameraIcon from "./CameraIcon.jsx";

export default function StreamCard({ stream, index, isSelected, onFrame, onSelect, onStatusChange, onRetry, onToggle, onRemove }) {
    const [status, setStatus] = useState(stream.playing ? "connecting" : "paused");
    const [frameUrl, setFrameUrl] = useState("");
    const [message, setMessage] = useState("");

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
    }, [onFrame, onStatusChange, stream.accessKey, stream.id, stream.playing, stream.retryCount, stream.url]);

    const statusLabel = {
        connecting: "Connecting",
        live: "Live",
        error: "Connection issue",
        paused: "Paused",
        stopped: "Paused",
    }[status] || "Connecting";

    return (
        <article className={`overflow-hidden rounded-xl border bg-[var(--color-surface)] transition-colors ${isSelected
            ? "border-[var(--color-olive-600)] ring-1 ring-[var(--color-olive-600)]"
            : "border-stone-200/80"
            }`}>
            <button
                aria-pressed={isSelected}
                className="camera-preview relative flex aspect-video w-full items-center justify-center overflow-hidden bg-stone-900 text-left"
                onClick={onSelect}
                type="button"
            >
                {frameUrl && status === "live" ? (
                    <img
                        alt={`Live feed from ${stream.name || `camera ${index + 1}`}`}
                        className="size-full object-cover"
                        src={frameUrl}
                    />
                ) : (
                    <div className="flex max-w-sm flex-col items-center px-5 text-center text-white/55">
                        <CameraIcon className="size-9" />
                        <span className="mt-3 max-w-xs text-xs font-medium leading-5 text-white/75">
                            {message || (status === "connecting" ? "Connecting to camera…" : status === "error" ? "Camera connection failed" : "Camera paused")}
                        </span>
                    </div>
                )}
                <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${status === "live"
                    ? "bg-black/75 text-[var(--color-olive-500)]"
                    : status === "error"
                        ? "bg-rose-950/90 text-rose-200"
                        : "bg-black/70 text-white"
                    }`}>
                    <span className={`size-2 rounded-full ${status === "live" ? "bg-[var(--color-olive-500)]" : status === "error" ? "bg-rose-400" : "bg-stone-300"}`} />
                    {statusLabel}
                </span>
                <span className="absolute right-3 top-3 rounded-md bg-black/70 px-2.5 py-1.5 text-[10px] font-medium text-white">
                    {new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date())}
                </span>
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-3 pt-10 text-white">
                    <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold uppercase tracking-wide">
                            CAM {String(index + 1).padStart(2, "0")} / {stream.location || stream.name || "Camera"}
                        </span>
                        <span className="mt-1 block truncate text-[10px] text-white/85">
                            {stream.name || stream.host}
                        </span>
                    </span>
                    <span aria-hidden="true" className="flex h-6 shrink-0 items-end gap-1">
                        {[9, 14, 20].map((height) => (
                            <span className={`w-1.5 rounded-t-sm ${status === "live" ? "bg-[var(--color-olive-500)]" : "bg-white/40"}`} key={height} style={{ height }} />
                        ))}
                    </span>
                </span>
            </button>
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                    <h3 className="truncate text-xs font-semibold text-stone-900">{stream.name || `Camera ${index + 1}`}</h3>
                    <p className="mt-0.5 truncate text-[10px] text-stone-500">{stream.location || stream.host}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    {status === "error" && (
                        <button
                            aria-label={`Retry camera ${index + 1}`}
                            className="rounded-md px-2 py-1.5 text-[10px] font-semibold text-[var(--color-forest-700)] hover:bg-[var(--color-forest-50)]"
                            onClick={onRetry}
                            type="button"
                        >
                            Retry
                        </button>
                    )}
                    <button
                        aria-label={`${stream.playing ? "Pause" : "Play"} camera ${index + 1}`}
                        className="flex size-8 items-center justify-center rounded-md border border-stone-200 text-stone-600 transition hover:bg-[var(--color-forest-50)] hover:text-[var(--color-forest-700)]"
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
                        className="flex size-8 shrink-0 items-center justify-center rounded-md border border-stone-200 text-stone-500 transition hover:bg-rose-50 hover:text-rose-600"
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
