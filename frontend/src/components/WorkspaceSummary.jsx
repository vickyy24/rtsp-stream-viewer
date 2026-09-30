import { LuActivity, LuTriangleAlert } from "react-icons/lu";
import CameraIcon from "./CameraIcon.jsx";

function SummaryCard({
    label,
    value,
    note,
    icon,
    iconClassName,
    valueClassName = "text-3xl text-stone-900",
}) {
    return (
        <div className="rounded-2xl border border-stone-200 bg-[var(--color-surface)] p-5 shadow-sm shadow-stone-200/40">
            <p className="text-xs font-medium text-stone-500">{label}</p>
            <div className="mt-3 flex items-end justify-between">
                <span className={`${valueClassName} font-semibold tracking-tight`}>
                    {value}
                </span>
                <span className={`mb-1 rounded-lg p-2 ${iconClassName}`}>{icon}</span>
            </div>
            <p className="mt-2 text-xs text-stone-400">{note}</p>
        </div>
    );
}

export default function WorkspaceSummary({ cameraCount, liveCount }) {
    return (
        <section aria-label="Workspace summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
                label="Total cameras"
                value={cameraCount}
                note="In this workspace"
                icon={<CameraIcon className="size-4" />}
                iconClassName="bg-[var(--color-forest-50)] text-[var(--color-forest-600)]"
            />
            <SummaryCard
                label="Live now"
                value={liveCount}
                note="Streams connected"
                icon={<LuActivity aria-hidden="true" className="size-4" />}
                iconClassName="bg-[var(--color-forest-50)] text-[var(--color-olive-700)]"
            />
            <SummaryCard
                label="Workspace status"
                value="Ready"
                note="Waiting for first stream"
                icon={<LuTriangleAlert aria-hidden="true" className="size-4" />}
                iconClassName="bg-[var(--color-clay-50)] text-[var(--color-clay-700)]"
                valueClassName="text-xl text-[var(--color-olive-700)]"
            />
        </section>
    );
}
