import { LuCamera } from "react-icons/lu";

export default function CameraThumbnails({ streams, statuses, frameUrls, selectedId, onSelect }) {
    if (!streams.length) return null;
    return (
        <section className="mt-3 rounded-xl border border-stone-200/80 bg-[var(--color-surface)] p-3">
            <div className="mb-2.5 flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold text-stone-900">Camera thumbnails</h2>
                <span className="text-[11px] text-stone-500">{streams.length} {streams.length === 1 ? "camera" : "cameras"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
                {streams.map((stream, index) => {
                    const isLive = statuses[stream.id] === "live";
                    const selected = selectedId === stream.id;
                    return (
                        <button
                            aria-pressed={selected}
                            className={`min-w-0 overflow-hidden rounded-lg border text-left transition-colors ${selected
                                ? "border-[var(--color-olive-600)] ring-1 ring-[var(--color-olive-600)]"
                                : "border-stone-200 hover:border-stone-300"
                                }`}
                            key={stream.id}
                            onClick={() => onSelect(stream.id)}
                            type="button"
                        >
                            <div className="aspect-video bg-stone-900">
                                {frameUrls[stream.id] ? (
                                    <img alt="" className="size-full object-cover" src={frameUrls[stream.id]} />
                                ) : (
                                    <div className="flex size-full items-center justify-center text-white/60">
                                        <LuCamera aria-hidden="true" className="size-5" />
                                    </div>
                                )}
                            </div>
                            <span className="flex min-w-0 items-center gap-2 px-2.5 py-2">
                                <span className={`size-2 shrink-0 rounded-full ${isLive ? "bg-[var(--color-olive-500)]" : statuses[stream.id] === "error" ? "bg-rose-500" : "bg-stone-300"}`} />
                                <span className="min-w-0">
                                    <span className="block truncate text-[11px] font-semibold text-stone-800">
                                        {stream.name || `Camera ${String(index + 1).padStart(2, "0")}`}
                                    </span>
                                    <span className="block truncate text-[10px] text-stone-500">
                                        {stream.location || stream.host}
                                    </span>
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
