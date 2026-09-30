import { LuNetwork, LuPause, LuPlay, LuRefreshCw, LuTrash2 } from "react-icons/lu";
import PageHeading from "../components/PageHeading.jsx";

export default function ConnectionsPage({ onRemove, onRetry, onToggle, statuses, streams }) {
    return (
        <div className="flex flex-col gap-5">
            <PageHeading
                description="RTSP sources connected to this browser workspace."
                title="Connections"
            />
            <section className="overflow-hidden rounded-xl border border-stone-200 bg-[var(--color-surface)]">
                <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
                    <LuNetwork aria-hidden="true" className="size-4 text-stone-500" />
                    <h2 className="text-sm font-semibold text-stone-800">RTSP connections</h2>
                    <span className="ml-auto text-xs text-stone-400">{streams.length} total</span>
                </div>
                {streams.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px] text-left">
                            <thead className="bg-stone-50 text-[11px] uppercase tracking-wide text-stone-400">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Camera</th>
                                    <th className="px-4 py-3 font-semibold">RTSP host</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {streams.map((stream, index) => {
                                    const status = statuses[stream.id] || "connecting";
                                    return (
                                        <tr key={stream.id}>
                                            <td className="px-4 py-3 text-sm font-medium text-stone-800">
                                                {stream.name || `Camera ${index + 1}`}
                                            </td>
                                            <td className="max-w-64 truncate px-4 py-3 text-xs text-stone-500">
                                                {stream.host}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-2 text-xs text-stone-600">
                                                    <span className={`size-2 rounded-full ${status === "live"
                                                        ? "bg-[var(--color-olive-500)]"
                                                        : status === "error"
                                                            ? "bg-rose-500"
                                                            : "bg-amber-500"
                                                        }`} />
                                                    {status === "live" ? "Connected" : status === "error" ? "Failed" : status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-1">
                                                    <button
                                                        aria-label={`${stream.playing ? "Pause" : "Play"} ${stream.name || `camera ${index + 1}`}`}
                                                        className="flex size-8 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100"
                                                        onClick={() => onToggle(stream.id)}
                                                        type="button"
                                                    >
                                                        {stream.playing
                                                            ? <LuPause className="size-4" />
                                                            : <LuPlay className="size-4" />}
                                                    </button>
                                                    {status === "error" && (
                                                        <button
                                                            aria-label={`Retry ${stream.name || `camera ${index + 1}`}`}
                                                            className="flex size-8 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100"
                                                            onClick={() => onRetry(stream.id)}
                                                            type="button"
                                                        >
                                                            <LuRefreshCw className="size-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        aria-label={`Remove ${stream.name || `camera ${index + 1}`}`}
                                                        className="flex size-8 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50"
                                                        onClick={() => onRemove(stream.id)}
                                                        type="button"
                                                    >
                                                        <LuTrash2 className="size-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="px-4 py-12 text-center text-sm text-stone-500">
                        Connections will appear here after you add a camera.
                    </p>
                )}
            </section>
        </div>
    );
}
