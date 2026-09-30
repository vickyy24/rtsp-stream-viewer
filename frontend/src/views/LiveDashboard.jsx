import { LuActivity, LuCircleCheck, LuLayoutGrid, LuPlus, LuTriangleAlert } from "react-icons/lu";
import StreamGrid from "../components/StreamGrid.jsx";

function Metric({ icon: Icon, label, value, detail }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-[var(--color-surface)] p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-forest-50)] text-[var(--color-forest-700)]">
                <Icon aria-hidden="true" className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-xs text-stone-500">{label}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-stone-800">{value}</p>
            </div>
            {detail && <span className="text-xs text-stone-400">{detail}</span>}
        </div>
    );
}

function ActivityList({ activities }) {
    return (
        <section className="rounded-xl border border-stone-200 bg-[var(--color-surface)] p-4">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-800">Recent activity</h2>
                <span className="text-[11px] text-stone-400">This session</span>
            </div>
            {activities.length ? (
                <ul className="flex flex-col gap-3">
                    {activities.slice(0, 6).map((activity) => (
                        <li className="flex items-start gap-2.5" key={activity.id}>
                            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${activity.tone === "error"
                                ? "bg-rose-500"
                                : activity.tone === "success"
                                    ? "bg-[var(--color-olive-500)]"
                                    : "bg-amber-500"
                                }`} />
                            <span className="min-w-0 flex-1 text-xs leading-5 text-stone-600">
                                {activity.message}
                            </span>
                            <time className="shrink-0 text-[10px] text-stone-400">
                                {new Intl.DateTimeFormat(undefined, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                }).format(activity.createdAt)}
                            </time>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="py-3 text-xs leading-5 text-stone-400">
                    Camera connections and status changes will appear here.
                </p>
            )}
        </section>
    );
}

export default function LiveDashboard({
    activities,
    layout,
    onAddCamera,
    onRemove,
    onRetry,
    onStatusChange,
    onToggle,
    onViewLayouts,
    streams,
    statuses,
}) {
    const liveCount = Object.values(statuses).filter((status) => status === "live").length;
    const errorCount = Object.values(statuses).filter((status) => status === "error").length;
    return (
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-stone-900">Live dashboard</h2>
                        <p className="mt-0.5 text-xs text-stone-500">Live camera feeds in this workspace</p>
                    </div>
                    <button
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--color-forest-800)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-forest-900)]"
                        onClick={onAddCamera}
                        type="button"
                    >
                        <LuPlus aria-hidden="true" className="size-4" />
                        Add camera
                    </button>
                </div>
                {streams.length ? (
                    <StreamGrid
                        layout={layout}
                        onRemove={onRemove}
                        onRetry={onRetry}
                        onStatusChange={onStatusChange}
                        onToggle={onToggle}
                        streams={streams}
                    />
                ) : (
                    <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-[var(--color-surface)] px-5 py-10 text-center">
                        <span className="flex size-12 items-center justify-center rounded-xl bg-[var(--color-forest-50)] text-[var(--color-forest-700)]">
                            <LuLayoutGrid aria-hidden="true" className="size-5" />
                        </span>
                        <h3 className="mt-4 text-sm font-semibold text-stone-800">No cameras in this view</h3>
                        <p className="mt-1 max-w-sm text-xs leading-5 text-stone-500">
                            Add an RTSP camera to begin monitoring its live feed.
                        </p>
                        <button
                            className="mt-4 rounded-lg bg-[var(--color-forest-800)] px-4 py-2.5 text-xs font-semibold text-white"
                            onClick={onAddCamera}
                            type="button"
                        >
                            Add your first camera
                        </button>
                    </div>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-[var(--color-surface)] px-3 py-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                        <LuLayoutGrid aria-hidden="true" className="size-4" />
                        Layout
                    </div>
                    <div className="flex gap-1.5">
                        {["1x1", "2x2", "3x3", "4x4"].map((value) => (
                            <button
                                aria-pressed={layout === value}
                                className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium ${layout === value
                                    ? "border-[var(--color-forest-700)] bg-[var(--color-forest-50)] text-[var(--color-forest-800)]"
                                    : "border-stone-200 text-stone-500 hover:bg-stone-50"
                                    }`}
                                key={value}
                                onClick={() => onViewLayouts(value)}
                                type="button"
                            >
                                {value}
                            </button>
                        ))}
                    </div>
                    <span className="text-[11px] text-stone-400">
                        {streams.length} {streams.length === 1 ? "camera" : "cameras"}
                    </span>
                </div>
            </div>

            <aside className="flex flex-col gap-3">
                <section className="rounded-xl border border-stone-200 bg-[var(--color-surface)] p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-stone-800">System status</h2>
                        <span className="text-xs text-stone-400">Current</span>
                    </div>
                    <div className="flex items-center gap-3 border-b border-stone-100 pb-3">
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-full border-[6px] border-[var(--color-forest-100)] text-sm font-bold text-[var(--color-forest-800)]">
                            {liveCount}/{streams.length}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-stone-800">Cameras online</p>
                            <p className="mt-0.5 text-xs text-stone-500">
                                {streams.length - liveCount - errorCount} connecting or paused
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <Metric
                            detail={null}
                            icon={LuCircleCheck}
                            label="Online"
                            value={liveCount}
                        />
                        <Metric
                            detail={null}
                            icon={LuTriangleAlert}
                            label="Offline"
                            value={errorCount}
                        />
                    </div>
                </section>
                <Metric
                    detail="active"
                    icon={LuActivity}
                    label="Stream connections"
                    value={`${liveCount} / ${streams.length}`}
                />
                <ActivityList activities={activities} />
            </aside>
        </div>
    );
}
