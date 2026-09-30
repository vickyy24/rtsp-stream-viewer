import { LuArrowRight } from "react-icons/lu";
import CameraIcon from "./CameraIcon.jsx";
import StreamCard from "./StreamCard.jsx";

function EmptyStreamState() {
    return (
        <div className="relative flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-stone-300 bg-[var(--color-surface)] px-6 py-12 text-center">
            <div className="relative mb-4 flex size-14 items-center justify-center rounded-2xl border border-[var(--color-forest-200)] bg-[var(--color-forest-50)] text-[var(--color-forest-600)] shadow-sm">
                <CameraIcon className="size-6" />
            </div>
            <h3 className="relative text-base font-semibold text-stone-800">Your view starts here</h3>
            <p className="relative mt-2 max-w-sm text-sm leading-6 text-stone-500">
                Add your first camera above. Your stream tiles will gather here in a responsive grid.
            </p>
            <a
                className="relative mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-forest-700)] transition hover:text-[var(--color-forest-900)]"
                href="#stream-url"
            >
                Add your first camera
                <LuArrowRight aria-hidden="true" className="size-4" />
            </a>
        </div>
    );
}

export default function StreamGrid({
    accessKey,
    onRemove,
    onRetry,
    onStatusChange,
    onToggle,
    streams,
}) {
    return (
        <section aria-labelledby="streams-heading" className="flex flex-col gap-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                    <h2 id="streams-heading" className="text-lg font-semibold tracking-tight text-stone-900">
                        Your cameras
                    </h2>
                    <p className="mt-1 text-sm text-stone-500">A clear view of every connected space.</p>
                </div>
                <span className="text-xs font-medium text-stone-500">
                    {streams.length} {streams.length === 1 ? "camera" : "cameras"}
                </span>
            </div>
            {streams.length ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {streams.map((stream, index) => (
                        <StreamCard
                            index={index}
                            key={stream.id}
                            stream={stream}
                            onRemove={() => onRemove(stream.id)}
                            onStatusChange={onStatusChange}
                            onRetry={() => onRetry(stream.id)}
                            onToggle={() => onToggle(stream.id)}
                        />
                    ))}
                </div>
            ) : <EmptyStreamState />}
        </section>
    );
}
