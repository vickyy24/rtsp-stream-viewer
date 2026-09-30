import {
    LuArchive,
    LuCamera,
    LuLayoutDashboard,
    LuLayoutGrid,
    LuNetwork,
    LuSettings,
} from "react-icons/lu";
import CameraIcon from "./CameraIcon.jsx";

const navigation = [
    {
        label: "Workspace",
        items: [
            { id: "live", label: "Live", icon: LuLayoutDashboard },
            { id: "cameras", label: "Cameras", icon: LuCamera },
            { id: "layouts", label: "Layouts", icon: LuLayoutGrid },
            { id: "archive", label: "Archive", icon: LuArchive },
        ],
    },
    {
        label: "System",
        items: [
            { id: "connections", label: "Connections", icon: LuNetwork },
            { id: "settings", label: "Settings", icon: LuSettings },
        ],
    },
];

export default function Sidebar({ activePage, onNavigate }) {
    return (
        <aside className="flex w-full shrink-0 flex-col border-b border-stone-200 bg-[var(--color-surface)] px-4 py-4 lg:min-h-screen lg:w-56 lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
            <a className="flex items-center gap-3 px-1" href="#main-content" aria-label="Signal home">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-forest-800)] text-white shadow-sm">
                    <CameraIcon className="size-5" />
                </span>
                <span className="min-w-0">
                    <span className="block text-sm font-bold tracking-[0.22em] text-stone-900">
                        SIGNAL
                    </span>
                    <span className="block text-[10px] uppercase tracking-wide text-stone-500">
                        RTSP stream viewer
                    </span>
                </span>
            </a>

            <nav aria-label="Main navigation" className="mt-6 flex gap-5 overflow-x-auto lg:mt-9 lg:flex-1 lg:flex-col lg:gap-6">
                {navigation.map((group) => (
                    <div className="shrink-0 lg:w-full" key={group.label}>
                        <p className="mb-2 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 lg:block">
                            {group.label}
                        </p>
                        <div className="flex gap-1 lg:flex-col">
                            {group.items.map(({ id, label, icon: Icon }) => {
                                const active = activePage === id
                                    || (id === "live" && activePage === "single-camera");
                                return (
                                    <button
                                        aria-current={active ? "page" : undefined}
                                        className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition lg:w-full ${active
                                            ? "bg-[var(--color-forest-100)] text-[var(--color-forest-700)]"
                                            : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                                            }`}
                                        key={id}
                                        onClick={() => onNavigate(id)}
                                        type="button"
                                    >
                                        <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="mt-5 hidden rounded-xl border border-stone-200 bg-stone-50 p-3 lg:block">
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                    <span className="size-2 rounded-full bg-[var(--color-olive-500)]" />
                    Local workspace
                </div>
                <p className="mt-1.5 text-xs leading-5 text-stone-500">
                    Camera list is kept in this browser session.
                </p>
            </div>
        </aside>
    );
}
