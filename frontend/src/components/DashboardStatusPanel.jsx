import { LuActivity, LuCircleAlert, LuCircleCheck } from "react-icons/lu";

function Metric({ icon: Icon, label, value, tone }) {
    const toneStyle = tone === "online"
        ? "border-[var(--color-forest-100)] bg-[var(--color-forest-50)] text-[var(--color-forest-700)]"
        : "border-stone-200 bg-stone-50 text-stone-500";
    return (
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-stone-200/80 bg-white/70 p-2.5">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${toneStyle}`}>
                <Icon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
                <p className="truncate text-xs text-stone-500">{label}</p>
                <p className="text-sm font-semibold text-stone-900">{value}</p>
            </div>
        </div>
    );
}

function ActivityList({ activities }) {
    const latestActivities = activities.slice(0, 6);
    if (!latestActivities.length) {
        return (
            <p className="py-2 text-xs leading-5 text-stone-500">
                Camera connections and status changes will appear here.
            </p>
        );
    }

    return (
        <ul className="flex flex-col gap-3">
            {latestActivities.map((activity) => (
                <li className="flex min-w-0 items-start gap-2" key={activity.id}>
                    <span className={`mt-1 size-2 shrink-0 rounded-full ${activity.tone === "error"
                        ? "bg-rose-500"
                        : activity.tone === "success"
                            ? "bg-[var(--color-olive-500)]"
                            : "bg-amber-500"
                        }`} />
                    <span className="min-w-0 flex-1 text-xs leading-4 text-stone-600">
                        {activity.message}
                    </span>
                    <time className="shrink-0 text-xs text-stone-400">
                        {new Intl.DateTimeFormat(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                        }).format(activity.createdAt)}
                    </time>
                </li>
            ))}
        </ul>
    );
}

export default function DashboardStatusPanel({ liveCount, errorCount, total, activities }) {
    const onlinePercent = total ? Math.round((liveCount / total) * 100) : 0;
    return (
        <aside className="flex min-w-0 flex-col gap-3">
            <section className="rounded-xl border border-stone-200/80 bg-[var(--color-surface)] p-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-stone-900">System status</h2>
                    <span className="text-xs text-[var(--color-forest-700)]">Live</span>
                </div>
                <div className="mt-4 flex items-center gap-3 border-b border-stone-200/70 pb-4">
                    <span
                        aria-label={`${liveCount} of ${total} cameras online`}
                        className="flex size-14 shrink-0 items-center justify-center rounded-full p-[6px]"
                        style={{ background: `conic-gradient(var(--color-olive-500) ${onlinePercent}%, #e5e7dc 0)` }}
                    >
                        <span className="flex size-full items-center justify-center rounded-full bg-[var(--color-surface)] text-sm font-bold text-stone-900">
                            {liveCount}/{total}
                        </span>
                    </span>
                    <div>
                        <p className="text-sm font-semibold text-stone-900">Cameras online</p>
                        <p className="mt-0.5 text-xs text-stone-500">
                            {total - liveCount - errorCount} connecting or paused
                        </p>
                    </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <Metric icon={LuCircleCheck} label="Online" value={liveCount} tone="online" />
                    <Metric icon={LuCircleAlert} label="Offline" value={errorCount} tone="offline" />
                </div>
            </section>

            <section className="rounded-xl border border-stone-200/80 bg-[var(--color-surface)] p-4">
                <div className="flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-forest-50)] text-[var(--color-forest-700)]">
                        <LuActivity aria-hidden="true" className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-stone-500">Stream health</p>
                            <p className="text-sm font-semibold text-stone-900">{onlinePercent}%</p>
                        </div>
                        <div
                            aria-label={`${onlinePercent}% of cameras online`}
                            className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100"
                            role="img"
                        >
                            <span className="block h-full rounded-full bg-[var(--color-olive-500)]" style={{ width: `${onlinePercent}%` }} />
                        </div>
                    </div>
                </div>
            </section>

            <section className="rounded-xl border border-stone-200/80 bg-[var(--color-surface)] p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-stone-900">Recent activity</h2>
                    <span className="text-xs text-stone-400">This session</span>
                </div>
                <ActivityList activities={activities} />
            </section>
        </aside>
    );
}
