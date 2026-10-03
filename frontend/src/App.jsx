import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useMatch, useNavigate } from "react-router";
import Sidebar from "./components/Sidebar.jsx";
import WorkspaceHeader from "./components/WorkspaceHeader.jsx";
import AppRoutes from "./app/AppRoutes.jsx";
import AppLayout from "./components/layout/AppLayout.jsx";
import LiveDashboard from "./views/LiveDashboard.jsx";
import AuthPage from "./views/AuthPage.jsx";
import { paths } from "./app/paths.js";
import {
    clearAuthToken,
    deleteSavedCamera,
    getCurrentAccount,
    getAuthToken,
    listCameras,
    saveCamera,
} from "./services/streamService.js";

function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const singleCameraMatch = useMatch("/live/camera/:cameraId");
    const selectedCameraId = singleCameraMatch?.params.cameraId || null;
    const activePage = location.pathname === paths.addCamera
        ? (location.state?.returnTo === paths.cameras ? "cameras" : "live")
        : location.pathname.startsWith("/cameras") ? "cameras"
        : location.pathname.startsWith("/layouts") ? "layouts"
            : location.pathname.startsWith("/archive") ? "archive"
                : location.pathname.startsWith("/connections") ? "connections"
                    : location.pathname.startsWith("/settings") ? "settings" : "live";
    const showLive = location.pathname === paths.live
        || location.pathname.startsWith(`${paths.live}/camera/`);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [layout, setLayout] = useState("2x2");
    const [streams, setStreams] = useState([]);
    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const [statuses, setStatuses] = useState({});
    const [activities, setActivities] = useState([]);
    const streamListRef = useRef(streams);
    const statusMapRef = useRef(statuses);
    streamListRef.current = streams;
    statusMapRef.current = statuses;

    useEffect(() => {
        let active = true;
        if (!getAuthToken()) {
            setAuthReady(true);
            return undefined;
        }
        getCurrentAccount()
            .then(({ user: account }) => {
                if (active) setUser(account);
            })
            .catch(() => {
                clearAuthToken();
            })
            .finally(() => {
                if (active) setAuthReady(true);
            });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        let active = true;
        if (!user) {
            setStreams([]);
            return undefined;
        }
        listCameras().then(({ cameras }) => {
            if (!active) return;
            setStreams(cameras.map((camera) => ({
                ...camera,
                playing: true,
                retryCount: 0,
            })));
        }).catch(() => {});
        return () => { active = false; };
    }, [user]);

    function signOut() {
        clearAuthToken();
        setUser(null);
        setStreams([]);
        navigate("/signin", { replace: true });
    }

    const isAuthPath = ["/signin", "/signup", "/verify-email"].includes(location.pathname);

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

    async function addCamera(camera) {
        const savedCamera = await saveCamera({
            name: camera.name,
            location: camera.location,
            url: camera.url,
        });
        const newCamera = {
            ...savedCamera,
            playing: true,
            retryCount: 0,
        };
        try {
            const { cameras } = await listCameras();
            setStreams(cameras.map((cameraItem) => ({
                ...cameraItem,
                playing: true,
                retryCount: 0,
            })));
        } catch {
            setStreams((current) => [...current, newCamera]);
        }
        addActivity(`${newCamera.name} added to the workspace`);
        navigate(location.state?.returnTo || "/live", { replace: true });
    }

    async function removeCamera(streamId) {
        const camera = streamListRef.current.find((stream) => stream.id === streamId);
        try {
            await deleteSavedCamera(streamId);
        } catch {
            return;
        }
        setStreams((current) => current.filter((stream) => stream.id !== streamId));
        const nextStatuses = { ...statusMapRef.current };
        delete nextStatuses[streamId];
        statusMapRef.current = nextStatuses;
        setStatuses(nextStatuses);
        addActivity(`${camera?.name || "Camera"} removed from the workspace`);
        if (selectedCameraId === streamId) navigate("/cameras");
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

    function openCameraWizard() {
        navigate(paths.addCamera, { state: { returnTo: location.pathname.startsWith(paths.cameras) ? paths.cameras : paths.live } });
    }

    const selectedCamera = streams.find((stream) => stream.id === selectedCameraId);
    const visibleStreams = selectedCamera ? [selectedCamera] : streams;
    const filteredLiveStreams = selectedCamera
        ? visibleStreams
        : visibleStreams.filter((camera) => !search.trim()
            || `${camera.name} ${camera.location}`.toLowerCase().includes(search.trim().toLowerCase()));
    const liveStatuses = Object.fromEntries(filteredLiveStreams.map((camera) => [
        camera.id,
        statuses[camera.id],
    ]));

    if (!authReady) {
        return <main className="flex min-h-dvh items-center justify-center text-sm text-stone-500">Loading your workspace…</main>;
    }
    if (!user) {
        return <AuthPage onLogin={setUser} />;
    }
    if (isAuthPath) {
        return <Navigate replace to={paths.live} />;
    }

    return (
        <AppLayout
            header={<WorkspaceHeader onLogout={signOut} onSearchChange={setSearch} searchValue={search} user={user} />}
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
            <AppRoutes
                activities={activities}
                layout={layout}
                navigate={navigate}
                onAddCamera={openCameraWizard}
                onAddCameraSave={addCamera}
                onRemove={removeCamera}
                onRetry={retryCamera}
                onToggle={toggleCamera}
                onViewCamera={(streamId) => navigate(`/live/camera/${encodeURIComponent(streamId)}`)}
                setLayout={setLayout}
                setSearch={setSearch}
                setStatusFilter={setStatusFilter}
                statusFilter={statusFilter}
                statuses={statuses}
                streams={streams}
                search={search}
            />
        </AppLayout>
    );
}

export default App;
