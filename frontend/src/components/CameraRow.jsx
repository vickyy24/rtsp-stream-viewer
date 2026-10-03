import { LuPause, LuPlay, LuTrash2 } from "react-icons/lu";
import CameraIcon from "./CameraIcon.jsx";

function getStatusLabel(status, playing) {
    if (!playing || status === "paused" || status === "stopped") return "Paused";
    if (status === "live") return "Online";
    if (status === "error") return "Offline";
    return "Connecting";
}

export default function CameraRow({ camera, index, onOpen, onRemove, onToggle, status }) {
    const statusLabel = getStatusLabel(status, camera.playing);
    const statusColor = statusLabel === "Online"
        ? "bg-[var(--color-olive-500)]"
        : statusLabel === "Offline"
            ? "bg-rose-500"
            : "bg-amber-500";

    return (
        <article className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center">
            <button
                aria-label={`Open ${camera.name || `Camera ${index + 1}`} live view`}
                className="flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-100 text-stone-400 sm:aspect-video sm:w-28"
                onClick={onOpen}
                type="button"
            >
                <CameraIcon className="size-7" />
            </button>
            <button className="min-w-0 flex-1 text-left" onClick={onOpen} type="button">
                <span className="block truncate text-sm font-semibold text-stone-800">
                    {camera.name || `Camera ${index + 1}`}
                </span>
                <span className="mt-1 block truncate text-xs text-stone-500">
                    {camera.location || "Location not set"}
                </span>
            </button>
            <div className="flex items-center justify-between gap-4 sm:justify-start">
                <div className="min-w-28">
                    <span className="flex items-center gap-2 text-xs font-medium text-stone-700">
                        <span className={`size-2 rounded-full ${statusColor}`} />
                        {statusLabel}
                    </span>
                    <span className="mt-1 block text-xs text-stone-400">RTSP stream</span>
                </div>
                <button
                    aria-label={`${camera.playing ? "Pause" : "Play"} ${camera.name || `camera ${index + 1}`}`}
                    className="flex size-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
                    onClick={onToggle}
                    type="button"
                >
                    {camera.playing
                        ? <LuPause aria-hidden="true" className="size-4" />
                        : <LuPlay aria-hidden="true" className="size-4" />}
                </button>
                <button
                    aria-label={`Remove ${camera.name || `camera ${index + 1}`}`}
                    className="flex size-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
                    onClick={onRemove}
                    type="button"
                >
                    <LuTrash2 aria-hidden="true" className="size-4" />
                </button>
            </div>
        </article>
    );
}
