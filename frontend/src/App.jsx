import { useCallback, useRef, useState } from "react";
import PageHeading from "./components/PageHeading.jsx";
import Sidebar from "./components/Sidebar.jsx";
import WorkspaceHeader from "./components/WorkspaceHeader.jsx";
import AddCameraWizard from "./views/AddCameraWizard.jsx";
import ArchivePage from "./views/ArchivePage.jsx";
import CamerasPage from "./views/CamerasPage.jsx";
import ConnectionsPage from "./views/ConnectionsPage.jsx";
import LayoutsPage from "./views/LayoutsPage.jsx";
import LiveDashboard from "./views/LiveDashboard.jsx";
import SettingsPage from "./views/SettingsPage.jsx";

const pageTitles = {
    live: "Live",
    "single-camera": "Live camera",
    cameras: "Cameras",
    layouts: "Layouts",
    archive: "Archive",
    connections: "Connections",
    settings: "Settings",
    "add-camera": "Add camera",
};

function App() {
    const [activePage, setActivePage] = useState("live");
    const [selectedCameraId, setSelectedCameraId] = useState(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [layout, setLayout] = useState("2x2");
    const [streams, setStreams] = useState([]);
    const [statuses, setStatuses] = useState({});
    const [activities, setActivities] = useState([]);
    const streamListRef = useRef(streams);
    const statusMapRef = useRef(statuses);
    streamListRef.current = streams;
    statusMapRef.current = statuses;

    const addActivity = useCallback((message, tone = "info") => {
        setActivities((current) => [
            { id: crypto.randomUUID(), message, tone, createdAt: new Date() },
            ...current,
        ].slice(0, 20));
    }, []);

    const updateStatus = useCallback((streamId, status) => {
        const previousStatus = statusMapRef.current[streamId];
        if (previousStatus === status) return;

        const nextStatuses = { ...statusMapRef.current, [streamId]: status };
        statusMapRef.current = nextStatuses;
        setStatuses(nextStatuses);

        if (status === "live" || status === "error") {
            const camera = streamListRef.current.find((stream) => stream.id === streamId);
            const cameraName = camera?.name || "Camera";
            addActivity(
                status === "live"
                    ? `${cameraName} connected`
                    : `${cameraName} connection failed`,
                status === "live" ? "success" : "error",
            );
        }
    }, [addActivity]);

    function addCamera(camera) {
        const newCamera = {
            ...camera,
            id: crypto.randomUUID(),
            playing: true,
            retryCount: 0,
        };
        setStreams((current) => [...current, newCamera]);
        addActivity(`${newCamera.name} added to the workspace`);
        setActivePage("live");
    }

    function removeCamera(streamId) {
        const camera = streamListRef.current.find((stream) => stream.id === streamId);
        setStreams((current) => current.filter((stream) => stream.id !== streamId));
        const nextStatuses = { ...statusMapRef.current };
        delete nextStatuses[streamId];
        statusMapRef.current = nextStatuses;
        setStatuses(nextStatuses);
        addActivity(`${camera?.name || "Camera"} removed from the workspace`);
        if (selectedCameraId === streamId) setActivePage("cameras");
    }

    function retryCamera(streamId) {
        const camera = streamListRef.current.find((stream) => stream.id === streamId);
        setStreams((current) => current.map((stream) => stream.id === streamId
            ? { ...stream, retryCount: stream.retryCount + 1, playing: true }
            : stream));
        addActivity(`Retrying ${camera?.name || "camera"}`);
    }

    function toggleCamera(streamId) {
        setStreams((current) => current.map((stream) => stream.id === streamId
            ? { ...stream, playing: !stream.playing }
            : stream));
    }

    function showCamera(streamId) {
        setSelectedCameraId(streamId);
        setActivePage("single-camera");
    }

    const selectedCamera = streams.find((stream) => stream.id === selectedCameraId);
    const visibleStreams = activePage === "single-camera" && selectedCamera
        ? [selectedCamera]
        : streams;
    const filteredLiveStreams = activePage === "single-camera"
        ? visibleStreams
        : visibleStreams.filter((camera) => !search.trim()
            || `${camera.name} ${camera.location} ${camera.host}`.toLowerCase().includes(search.trim().toLowerCase()));
    const liveStatuses = Object.fromEntries(filteredLiveStreams.map((camera) => [
        camera.id,
        statuses[camera.id],
    ]));

    return (
        <div className="min-h-screen bg-[var(--color-app-background)] text-stone-900 lg:flex">
            <Sidebar activePage={activePage} onNavigate={setActivePage} />
            <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-8" id="main-content">
                <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
                    <WorkspaceHeader
                        onSearchChange={setSearch}
                        searchValue={search}
                        title={pageTitles[activePage]}
                    />

                    <div className="flex items-center gap-2 text-xs text-stone-400 sm:hidden">
                        <span>Workspace</span>
                        <span aria-hidden="true">/</span>
                        <span className="font-medium text-stone-700">{pageTitles[activePage]}</span>
                    </div>

                    <div hidden={activePage !== "live" && activePage !== "single-camera"}>
                        {activePage === "single-camera" && (
                            <div className="mb-3 flex items-center justify-between">
                                <PageHeading
                                    description={selectedCamera?.location || selectedCamera?.host || "Single camera view"}
                                    title={selectedCamera?.name || "Live camera"}
                                />
                                <button
                                    className="text-xs font-semibold text-[var(--color-forest-700)] hover:underline"
                                    onClick={() => setActivePage("live")}
                                    type="button"
                                >
                                    Back to dashboard
                                </button>
                            </div>
                        )}
                        <LiveDashboard
                            activities={activities}
                            layout={activePage === "single-camera" ? "1x1" : layout}
                            onAddCamera={() => setActivePage("add-camera")}
                            onRemove={removeCamera}
                            onRetry={retryCamera}
                            onStatusChange={updateStatus}
                            onToggle={toggleCamera}
                            onViewLayouts={setLayout}
                            streams={filteredLiveStreams}
                            statuses={liveStatuses}
                        />
                    </div>

                    {activePage === "cameras" && (
                        <CamerasPage
                            onAddCamera={() => setActivePage("add-camera")}
                            onOpenCamera={showCamera}
                            onRemove={removeCamera}
                            onToggle={toggleCamera}
                            query={search}
                            setQuery={setSearch}
                            setStatusFilter={setStatusFilter}
                            statusFilter={statusFilter}
                            statuses={statuses}
                            streams={streams}
                        />
                    )}
                    {activePage === "add-camera" && (
                        <AddCameraWizard
                            onCancel={() => setActivePage("cameras")}
                            onSave={addCamera}
                        />
                    )}
                    {activePage === "layouts" && (
                        <LayoutsPage
                            layout={layout}
                            onApply={(nextLayout) => {
                                setLayout(nextLayout);
                                setActivePage("live");
                            }}
                        />
                    )}
                    {activePage === "archive" && (
                        <ArchivePage activities={activities} streams={streams} />
                    )}
                    {activePage === "connections" && (
                        <ConnectionsPage
                            onRemove={removeCamera}
                            onRetry={retryCamera}
                            onToggle={toggleCamera}
                            statuses={statuses}
                            streams={streams}
                        />
                    )}
                    {activePage === "settings" && <SettingsPage />}
                </div>
            </main>
        </div>
    );
}

export default App;
