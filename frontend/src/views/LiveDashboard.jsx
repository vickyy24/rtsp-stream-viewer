import { useCallback, useEffect, useRef, useState } from "react";
import { LuLayoutGrid, LuPlus, LuScanEye } from "react-icons/lu";
import CameraThumbnails from "../components/CameraThumbnails.jsx";
import DashboardStatusPanel from "../components/DashboardStatusPanel.jsx";
import DashboardToolbar from "../components/DashboardToolbar.jsx";
import StreamGrid from "../components/StreamGrid.jsx";

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
    const [selectedId, setSelectedId] = useState(streams[0]?.id || null);
    const [frameUrls, setFrameUrls] = useState({});
    const [isFullscreen, setIsFullscreen] = useState(false);
    const frameTimes = useRef({});
    const frameUrlsRef = useRef({});
    const dashboardRef = useRef(null);
    const selectedStream = streams.find((stream) => stream.id === selectedId) || streams[0];
    const selectedStatus = selectedStream ? statuses[selectedStream.id] || "connecting" : "offline";

    useEffect(() => {
        if (streams.length && !streams.some((stream) => stream.id === selectedId)) {
            setSelectedId(streams[0].id);
        }
    }, [selectedId, streams]);

    useEffect(() => {
        const removedIds = Object.keys(frameUrlsRef.current).filter(
            (id) => !streams.some((stream) => stream.id === id),
        );
        if (!removedIds.length) return;
        const nextFrames = { ...frameUrlsRef.current };
        removedIds.forEach((id) => {
            URL.revokeObjectURL(nextFrames[id]);
            delete nextFrames[id];
            delete frameTimes.current[id];
        });
        frameUrlsRef.current = nextFrames;
        setFrameUrls(nextFrames);
    }, [streams]);

    useEffect(() => () => {
        Object.values(frameUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    }, []);

    useEffect(() => {
        function syncFullscreen() {
            setIsFullscreen(document.fullscreenElement === dashboardRef.current);
        }
        document.addEventListener("fullscreenchange", syncFullscreen);
        return () => document.removeEventListener("fullscreenchange", syncFullscreen);
    }, []);

    const receiveFrame = useCallback((streamId, blob) => {
        const now = Date.now();
        if (now - (frameTimes.current[streamId] || 0) < 1200) return;
        frameTimes.current[streamId] = now;
        const nextUrl = URL.createObjectURL(blob);
        const previousUrl = frameUrlsRef.current[streamId];
        const nextFrames = { ...frameUrlsRef.current, [streamId]: nextUrl };
        frameUrlsRef.current = nextFrames;
        setFrameUrls(nextFrames);
        if (previousUrl) window.setTimeout(() => URL.revokeObjectURL(previousUrl), 1500);
    }, []);

    const pauseAll = useCallback(() => {
        streams.forEach((stream) => {
            if (stream.playing) onToggle(stream.id);
        });
    }, [onToggle, streams]);

    const toggleFullscreen = useCallback(async () => {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else if (dashboardRef.current?.requestFullscreen) {
            await dashboardRef.current.requestFullscreen();
        }
    }, []);

    const takeSnapshot = useCallback(async () => {
        if (!selectedStream || !frameUrls[selectedStream.id]) return;
        const response = await fetch(frameUrls[selectedStream.id]);
        const image = await response.blob();
        const objectUrl = URL.createObjectURL(image);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `${(selectedStream.name || "camera").replace(/[^a-z0-9-_]/gi, "-")}-snapshot.jpg`;
        link.click();
        URL.revokeObjectURL(objectUrl);
    }, [frameUrls, selectedStream]);

    return (
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
            <section className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-base font-semibold text-stone-900">Live dashboard</h1>
                        <p className="mt-0.5 text-xs text-stone-500">Live camera feeds in this workspace</p>
                    </div>
                    <button
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-forest-800)] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-forest-900)]"
                        onClick={onAddCamera}
                        type="button"
                    >
                        <LuPlus aria-hidden="true" className="size-4" />
                        Add camera
                    </button>
                </div>

                <div
                    className={isFullscreen ? "fixed inset-0 z-50 flex flex-col gap-3 overflow-hidden bg-[var(--color-app-background)] p-3 sm:p-4" : ""}
                    ref={dashboardRef}
                >
                    {streams.length ? (
                        <StreamGrid
                            layout={layout}
                            isFullscreen={isFullscreen}
                            onFrame={receiveFrame}
                            onRemove={onRemove}
                            onRetry={onRetry}
                            onSelect={setSelectedId}
                            onStatusChange={onStatusChange}
                            onToggle={onToggle}
                            selectedId={selectedStream?.id}
                            streams={streams}
                        />
                    ) : (
                        <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-[var(--color-surface)] px-5 py-10 text-center">
                            <span className="flex size-12 items-center justify-center rounded-xl bg-[var(--color-forest-50)] text-[var(--color-forest-700)]">
                                <LuLayoutGrid aria-hidden="true" className="size-5" />
                            </span>
                            <h2 className="mt-4 text-sm font-semibold text-stone-900">No cameras in this view</h2>
                            <p className="mt-1 max-w-sm text-xs leading-5 text-stone-500">
                                Add an RTSP camera to begin monitoring its live feed.
                            </p>
                            <button
                                className="mt-4 rounded-lg bg-[var(--color-forest-800)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--color-forest-900)]"
                                onClick={onAddCamera}
                                type="button"
                            >
                                Add your first camera
                            </button>
                        </div>
                    )}

                    <DashboardToolbar
                        frameAvailable={Boolean(selectedStream && frameUrls[selectedStream.id])}
                        isFullscreen={isFullscreen}
                        layout={layout}
                        onLayoutChange={onViewLayouts}
                        onPauseAll={pauseAll}
                        onSnapshot={takeSnapshot}
                        onToggleFullscreen={toggleFullscreen}
                        streams={streams}
                    />
                    <CameraThumbnails
                        frameUrls={frameUrls}
                        isFullscreen={isFullscreen}
                        onSelect={setSelectedId}
                        selectedId={selectedStream?.id}
                        statuses={statuses}
                        streams={streams}
                    />
                </div>
            </section>

            <div className="flex min-w-0 flex-col gap-3">
                <DashboardStatusPanel
                    activities={activities}
                    errorCount={errorCount}
                    liveCount={liveCount}
                    total={streams.length}
                />
                <section className="rounded-xl border border-stone-200/80 bg-[var(--color-surface)] p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <LuScanEye aria-hidden="true" className="size-4 text-[var(--color-forest-700)]" />
                        <h2 className="text-sm font-semibold text-stone-900">Stream details</h2>
                        {selectedStream && (
                            <span className={`ml-auto size-2 shrink-0 rounded-full ${selectedStatus === "live" ? "bg-[var(--color-olive-500)]" : selectedStatus === "error" ? "bg-rose-500" : "bg-stone-300"}`} />
                        )}
                    </div>
                    {selectedStream ? (
                        <dl className="divide-y divide-stone-200/70 rounded-lg border border-stone-200/80 px-3">
                            <DetailRow label="Camera" value={selectedStream.name || "Camera"} />
                            <DetailRow label="Location" value={selectedStream.location || "Not specified"} />
                            <DetailRow label="Status" value={selectedStatus === "live" ? "Live" : selectedStatus === "error" ? "Connection issue" : selectedStatus} />
                            <DetailRow label="Source host" value={selectedStream.host || "Unavailable"} />
                        </dl>
                    ) : (
                        <p className="text-xs leading-5 text-stone-500">Add a camera to see its connection details.</p>
                    )}
                </section>
            </div>
        </div>
    );
}

function DetailRow({ label, value }) {
    return (
        <div className="flex items-start justify-between gap-3 py-2.5 text-xs">
            <dt className="shrink-0 text-stone-500">{label}</dt>
            <dd className="min-w-0 break-all text-right font-medium text-stone-800">{value}</dd>
        </div>
    );
}
