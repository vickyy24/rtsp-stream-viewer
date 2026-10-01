import { Navigate, Route, Routes, useLocation } from "react-router";
import ArchivePage from "../views/ArchivePage.jsx";
import AddCameraWizard from "../views/AddCameraWizard.jsx";
import CamerasPage from "../views/CamerasPage.jsx";
import ConnectionsPage from "../views/ConnectionsPage.jsx";
import LayoutsPage from "../views/LayoutsPage.jsx";
import SettingsPage from "../views/SettingsPage.jsx";
import { paths } from "./paths.js";

export default function AppRoutes({
    activities,
    layout,
    navigate,
    onAddCamera,
    onAddCameraSave,
    onRemove,
    onRetry,
    onToggle,
    onViewCamera,
    search,
    setLayout,
    setSearch,
    setStatusFilter,
    statusFilter,
    statuses,
    streams,
}) {
    const location = useLocation();

    return (
            <Routes>
                <Route element={<Navigate replace to={paths.live} />} path="/" />
                <Route element={null} path="/live" />
                <Route element={null} path="/live/camera/:cameraId" />
                <Route
                    element={(
                        <CamerasPage
                            onAddCamera={onAddCamera}
                            onOpenCamera={onViewCamera}
                            onRemove={onRemove}
                            onToggle={onToggle}
                            query={search}
                            setQuery={setSearch}
                            setStatusFilter={setStatusFilter}
                            statusFilter={statusFilter}
                            statuses={statuses}
                            streams={streams}
                        />
                    )}
                    path={paths.cameras}
                />
                <Route
                    element={(
                        <AddCameraWizard
                            onCancel={() => navigate(location.state?.returnTo || paths.live, { replace: true })}
                            onSave={onAddCameraSave}
                        />
                    )}
                    path={paths.addCamera}
                />
                <Route
                    element={(
                        <LayoutsPage
                            layout={layout}
                            onApply={(nextLayout) => {
                                setLayout(nextLayout);
                                navigate(paths.live);
                            }}
                        />
                    )}
                    path={paths.layouts}
                />
                <Route element={<ArchivePage activities={activities} streams={streams} />} path={paths.archive} />
                <Route element={<ConnectionsPage onRemove={onRemove} onRetry={onRetry} onToggle={onToggle} statuses={statuses} streams={streams} />} path={paths.connections} />
                <Route element={<SettingsPage />} path={paths.settings} />
                <Route element={<Navigate replace to={paths.live} />} path="*" />
            </Routes>
    );
}
