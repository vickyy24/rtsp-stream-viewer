import { LuPlus, LuSearch } from "react-icons/lu";
import CameraRow from "../components/CameraRow.jsx";
import PageHeading from "../components/PageHeading.jsx";
import Button from "../components/ui/Button.jsx";
import SurfaceCard from "../components/ui/SurfaceCard.jsx";

const filters = [
    { id: "all", label: "All" },
    { id: "online", label: "Online" },
    { id: "offline", label: "Offline" },
];

export default function CamerasPage({
    onAddCamera,
    onOpenCamera,
    onRemove,
    onToggle,
    query,
    setQuery,
    setStatusFilter,
    statusFilter,
    statuses,
    streams,
}) {
    const filteredStreams = streams.filter((camera) => {
        const cameraStatus = statuses[camera.id];
        const isOnline = cameraStatus === "live";
        const isOffline = cameraStatus === "error" || cameraStatus === "paused";
        const matchesStatus = statusFilter === "all"
            || (statusFilter === "online" && isOnline)
            || (statusFilter === "offline" && isOffline);
        const search = query.trim().toLowerCase();
        const matchesSearch = !search
            || `${camera.name} ${camera.location} ${camera.host}`.toLowerCase().includes(search);
        return matchesStatus && matchesSearch;
    });

    return (
        <div className="flex flex-col gap-5">
            <PageHeading
                action={(
                    <Button
                        variant="primary"
                        onClick={onAddCamera}
                        type="button"
                    >
                        <LuPlus aria-hidden="true" className="size-4" />
                        Add camera
                    </Button>
                )}
                description="Manage your camera sources and their current connection state."
                title="Cameras"
            />

            <SurfaceCard as="section">
                <label className="flex max-w-md items-center gap-2 rounded-lg border border-stone-200 bg-[var(--color-canvas-soft)] px-3 py-2">
                    <LuSearch aria-hidden="true" className="size-4 text-stone-400" />
                    <span className="sr-only">Search cameras</span>
                    <input
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search cameras…"
                        value={query}
                    />
                </label>
                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter cameras by status">
                    {filters.map(({ id, label }) => {
                        const count = id === "all"
                            ? streams.length
                                : streams.filter((camera) => id === "online"
                                    ? statuses[camera.id] === "live"
                                    : statuses[camera.id] === "error" || statuses[camera.id] === "paused").length;
                        return (
                            <button
                                aria-pressed={statusFilter === id}
                                className={`rounded-lg border px-3 py-2 text-xs font-medium ${statusFilter === id
                                    ? "border-[var(--color-forest-700)] bg-[var(--color-forest-200)] text-[var(--color-forest-900)]"
                                    : "border-stone-200 text-stone-500 hover:bg-stone-50"
                                    }`}
                                key={id}
                                onClick={() => setStatusFilter(id)}
                                type="button"
                            >
                                {label} ({count})
                            </button>
                        );
                    })}
                </div>
            </SurfaceCard>

            {filteredStreams.length ? (
                <div className="flex flex-col gap-2">
                    {filteredStreams.map((camera) => (
                        <CameraRow
                            camera={camera}
                            index={streams.findIndex((stream) => stream.id === camera.id)}
                            key={camera.id}
                            onOpen={() => onOpenCamera(camera.id)}
                            onRemove={() => onRemove(camera.id)}
                            onToggle={() => onToggle(camera.id)}
                            status={statuses[camera.id]}
                        />
                    ))}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-stone-300 bg-[var(--color-surface)] px-6 py-14 text-center">
                    <h3 className="text-sm font-semibold text-stone-800">
                        {streams.length ? "No cameras match this filter" : "No cameras added yet"}
                    </h3>
                    <p className="mt-1 text-xs text-stone-500">
                        {streams.length
                            ? "Try another search or status filter."
                            : "Add a camera to see its connection and stream details here."}
                    </p>
                </div>
            )}
        </div>
    );
}
