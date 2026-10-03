import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useOutletContext } from "react-router";
import AppRoutes from "./app/AppRoutes.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import ArchivePage from "./pages/ArchivePage.jsx";
import AddCameraWizard from "./pages/AddCameraWizard.jsx";
import CamerasPage from "./pages/CamerasPage.jsx";
import ConnectionsPage from "./pages/ConnectionsPage.jsx";
import LayoutsPage from "./pages/LayoutsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import { clearAuthToken, getCurrentAccount, getAuthToken } from "./services/streamService.js";

// ── Route element wrappers — pull handlers from AppRoutes via Outlet context ──

function CamerasRoute() {
    const { streams, statuses, statusFilter, search, setSearch, setStatusFilter, openCameraWizard, removeCamera, toggleCamera, navigate } = useOutletContext();
    return (
        <CamerasPage
            onAddCamera={openCameraWizard}
            onOpenCamera={(id) => navigate(`/live/camera/${encodeURIComponent(id)}`)}
            onRemove={removeCamera}
            onToggle={toggleCamera}
            query={search}
            setQuery={setSearch}
            setStatusFilter={setStatusFilter}
            statusFilter={statusFilter}
            statuses={statuses}
            streams={streams}
        />
    );
}

function AddCameraRoute() {
    const { addCamera, navigate, location } = useOutletContext();
    return (
        <AddCameraWizard
            onCancel={() => navigate(location.state?.returnTo || "/live", { replace: true })}
            onSave={addCamera}
        />
    );
}

function LayoutsRoute() {
    const { layout, setLayout, navigate } = useOutletContext();
    return (
        <LayoutsPage
            layout={layout}
            onApply={(nextLayout) => { setLayout(nextLayout); navigate("/live"); }}
        />
    );
}

function ArchiveRoute() {
    const { activities, streams } = useOutletContext();
    return <ArchivePage activities={activities} streams={streams} />;
}

function ConnectionsRoute() {
    const { statuses, streams, removeCamera, retryCamera, toggleCamera } = useOutletContext();
    return <ConnectionsPage onRemove={removeCamera} onRetry={retryCamera} onToggle={toggleCamera} statuses={statuses} streams={streams} />;
}

// ── App — owns BrowserRouter and every route in the project ──────────────────

export default function App() {
    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);

    useEffect(() => {
        let active = true;
        if (!getAuthToken()) { setAuthReady(true); return undefined; }
        getCurrentAccount()
            .then(({ user: account }) => { if (active) setUser(account); })
            .catch(() => { clearAuthToken(); })
            .finally(() => { if (active) setAuthReady(true); });
        return () => { active = false; };
    }, []);

    if (!authReady) {
        return (
            <main className="flex min-h-dvh items-center justify-center text-sm text-stone-500">
                Loading your workspace…
            </main>
        );
    }

    return (
        <BrowserRouter>
            <Routes>
                {/* ── Auth routes ───────────────────────────────────── */}
                <Route path="/signin"          element={user ? <Navigate replace to="/live" /> : <AuthPage onLogin={setUser} />} />
                <Route path="/signup"          element={user ? <Navigate replace to="/live" /> : <AuthPage onLogin={setUser} />} />
                <Route path="/verify-email"    element={user ? <Navigate replace to="/live" /> : <AuthPage onLogin={setUser} />} />
                <Route path="/forgot-password" element={user ? <Navigate replace to="/live" /> : <AuthPage onLogin={setUser} />} />
                <Route path="/reset-password"  element={user ? <Navigate replace to="/live" /> : <AuthPage onLogin={setUser} />} />

                {/* ── Protected app routes (nested under AppRoutes layout) ── */}
                <Route element={user ? <AppRoutes user={user} onLogout={() => setUser(null)} /> : <Navigate replace to="/signin" />}>
                    <Route index element={<Navigate replace to="/live" />} />
                    <Route path="/live"                  element={null} />
                    <Route path="/live/camera/:cameraId" element={null} />
                    <Route path="/cameras"               element={<CamerasRoute />} />
                    <Route path="/add-camera"             element={<AddCameraRoute />} />
                    <Route path="/layouts"               element={<LayoutsRoute />} />
                    <Route path="/archive"               element={<ArchiveRoute />} />
                    <Route path="/connections"           element={<ConnectionsRoute />} />
                    <Route path="/settings"              element={<SettingsPage />} />
                    <Route path="*"                           element={<Navigate replace to="/live" />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
