import { LuArchive, LuCalendarDays } from "react-icons/lu";
import PageHeading from "../components/PageHeading.jsx";

export default function ArchivePage({ activities, streams }) {
    return (
        <div className="flex flex-col gap-5">
            <PageHeading
                description="Review stored recordings and events from selected cameras."
                title="Archive"
            />
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
                <div className="rounded-xl border border-stone-200 bg-[var(--color-surface)] p-4">
                    <div className="flex flex-col gap-3 border-b border-stone-100 pb-4 sm:flex-row sm:items-end">
                        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-stone-600">
                            Camera
                            <select className="rounded-lg border border-stone-200 bg-white px-3 py-2.5" disabled>
                                <option>{streams[0]?.name || "No cameras available"}</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs font-medium text-stone-600">
                            Date
                            <span className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 text-stone-400">
                                <LuCalendarDays aria-hidden="true" className="size-4" />
                                Recording dates unavailable
                            </span>
                        </label>
                    </div>
                    <div className="flex min-h-80 flex-col items-center justify-center px-5 py-12 text-center">
                        <span className="flex size-12 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
                            <LuArchive aria-hidden="true" className="size-5" />
                        </span>
                        <h2 className="mt-4 text-sm font-semibold text-stone-800">No recordings to review</h2>
                        <p className="mt-1 max-w-md text-xs leading-5 text-stone-500">
                            Recording and playback storage aren’t part of the current stream service. Live feeds are sent as temporary JPEG frames and are not saved.
                        </p>
                    </div>
                </div>
                <aside className="rounded-xl border border-stone-200 bg-[var(--color-surface)] p-4">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-stone-800">Connection activity</h2>
                        <span className="text-[10px] text-stone-400">This session</span>
                    </div>
                    {activities.length ? (
                        <ul className="mt-3 flex flex-col gap-3">
                            {activities.slice(0, 8).map((activity) => (
                                <li className="flex gap-2 text-xs leading-5 text-stone-600" key={activity.id}>
                                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${activity.tone === "error" ? "bg-rose-500" : "bg-[var(--color-olive-500)]"}`} />
                                    <span className="min-w-0 flex-1">{activity.message}</span>
                                    <time className="shrink-0 text-[10px] text-stone-400">
                                        {new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(activity.createdAt)}
                                    </time>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-2 text-xs leading-5 text-stone-500">
                        Motion and person-detection events require camera metadata that the current RTSP backend does not provide.
                        </p>
                    )}
                </aside>
            </section>
        </div>
    );
}
