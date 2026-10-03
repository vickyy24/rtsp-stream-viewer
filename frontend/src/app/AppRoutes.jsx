import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useMatch, useNavigate } from "react-router";
import Sidebar from "../components/Sidebar.jsx";
import WorkspaceHeader from "../components/WorkspaceHeader.jsx";
import AppLayout from "../components/layout/AppLayout.jsx";
import LiveDashboard from "../views/LiveDashboard.jsx";
import {
    clearAuthToken,
    deleteSavedCamera,
    listCameras,
    saveCamera,
} from "../services/streamService.js";

export default function AppRoutes({ user, onLogout }) {
    const navigate = useNavigate();
    const location = useLocation();
    const singleCameraMatch = useMatch("/live/camera/:cameraId");
    const selectedCameraId = singleCameraMatch?.params.cameraId || null;

    const activePage = location.pathname === "/add-camera"
        ? (location.state?.returnTo === "/cameras" ? "cameras" : "live")
        : location.pathname.startsWith("/cameras") ? "cameras"
        : location.pathname.startsWith("/layouts") ? "layouts"
            : location.pathname.startsWith("/archive") ? "archive"
                : location.pathname.startsWith("/connections") ? "connections"
                    : location.pathname.startsWith("/settings") ? "settings" : "live";

    const showLive = location.pathname === "/live"
        || location.pathname.startsWith("/live/camera/");

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

    useEffect(() => {
        function expireSession() {
            clearAuthToken();
            onLogout();
            navigate("/signin", { replace: true });
        }
        window.addEventListener("signal:auth-expired", expireSession);
        return () => window.removeEventListener("signal:auth-expired", expireSession);
    }, [navigate, onLogout]);

    useEffect(() => {
        let active = true;
        if (!user) { setStreams([]); return undefined; }
        listCameras().then(({ cameras }) => {
            if (!active) return;
            setStreams(cameras.map((camera) => ({ ...camera, playing: true, retryCount: 0 })));
        }).catch(() => {});
        return () => { active = false; };
    }, [user]);

    function signOut() {
        clearAuthToken();
        onLogout();
        navigate("/signin", { replace: true });
    }

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
            const camera = streamListRef.current.find((s) => s.id === streamId);
            const cameraName = camera?.name || "Camera";
            addActivity(
                status === "live" ? `${cameraName} connected` : `${cameraName} connection failed`,
                status === "live" ? "success" : "error",
            );
        }
    }, [addActivity]);

    async function addCamera(camera) {
        const savedCamera = await saveCamera({ name: camera.name, location: camera.location, url: camera.url });
        const newCamera = { ...savedCamera, playing: true, retryCount: 0 };
        try {
            const { cameras } = await listCameras();
            setStreams(cameras.map((c) => ({ ...c, playing: true, retryCount: 0 })));
        } catch {
            setStreams((current) => [...current, newCamera]);
        }
        addActivity(`${newCamera.name} added to the workspace`);
        navigate(location.state?.returnTo || "/live", { replace: true });
    }

    async function removeCamera(streamId) {
        const camera = streamListRef.current.find((s) => s.id === streamId);
        try { await deleteSavedCamera(streamId); } catch { return; }
        setStreams((current) => current.filter((s) => s.id !== streamId));
        const nextStatuses = { ...statusMapRef.current };
        delete nextStatuses[streamId];
        statusMapRef.current = nextStatuses;
        setStatuses(nextStatuses);
        addActivity(`${camera?.name || "Camera"} removed from the workspace`);
        if (selectedCameraId === streamId) navigate("/cameras");
    }

    function retryCamera(streamId) {
        const camera = streamListRef.current.find((s) => s.id === streamId);
        setStreams((current) => current.map((s) => s.id === streamId
            ? { ...s, retryCount: s.retryCount + 1, playing: true } : s));
        addActivity(`Retrying ${camera?.name || "camera"}`);
    }

    function toggleCamera(streamId) {
        setStreams((current) => current.map((s) => s.id === streamId
            ? { ...s, playing: !s.playing } : s));
    }

    function openCameraWizard() {
        navigate("/add-camera", {
            state: { returnTo: location.pathname.startsWith("/cameras") ? "/cameras" : "/live" },
        });
    }

    const selectedCamera = streams.find((s) => s.id === selectedCameraId);
    const visibleStreams = selectedCamera ? [selectedCamera] : streams;
    const filteredLiveStreams = selectedCamera
        ? visibleStreams
        : visibleStreams.filter((camera) => !search.trim()
            || `${camera.name} ${camera.location}`.toLowerCase().includes(search.trim().toLowerCase()));
    const liveStatuses = Object.fromEntries(filteredLiveStreams.map((camera) => [camera.id, statuses[camera.id]]));

    // Expose handlers via Outlet context so App.jsx route elements can use them
    const ctx = {
        activities, layout, search, setLayout, setSearch, setStatusFilter, statuses, statusFilter, streams,
        addCamera, openCameraWizard, removeCamera, retryCamera, toggleCamera,
        navigate, location,
    };

    return (
        <AppLayout
            header={<WorkspaceHeader onLogout={signOut} onSearchChange={setSearch} searchValue={search} />}
            liveContent={(
                <>
                    {selectedCamera && (
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <h1 className="text-xl font-semibold tracking-tight text-stone-900">{selectedCamera.name || "Live camera"}</h1>
                                <p className="mt-0.5 text-xs text-stone-500">{selectedCamera.location || "Single camera view"}</p>
                            </div>
                            <button
                                className="text-sm font-semibold text-[var(--color-forest-700)] hover:underline"
                                onClick={() => navigate("/live")}
                                type="button"
                            >
                                Back to dashboard
                            </button>
                        </div>
                    )}
                    <LiveDashboard
                        activities={activities}
                        layout={selectedCamera ? "1x1" : layout}
                        onAddCamera={openCameraWizard}
                        onRetry={retryCamera}
                        onStatusChange={updateStatus}
                        onToggle={toggleCamera}
                        onViewLayouts={setLayout}
                        streams={filteredLiveStreams}
                        statuses={liveStatuses}
                    />
                </>
            )}
            showLive={showLive}
            sidebar={<Sidebar activePage={activePage} onLogout={signOut} user={user} />}
        >
            <Outlet context={ctx} />
        </AppLayout>
    );
}
