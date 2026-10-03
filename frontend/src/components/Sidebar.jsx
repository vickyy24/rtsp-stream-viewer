import { Link, NavLink } from "react-router";
import {
    LuHistory,
    LuLayoutGrid,
    LuLogOut,
    LuMonitor,
    LuNetwork,
    LuSettings,
    LuVideo,
} from "react-icons/lu";
import SignalLogo from "./SignalLogo.jsx";
import { paths } from "../app/paths.js";

const groups = [
    {
        label: "Workspace",
        items: [
            { id: "live", label: "Live", to: paths.live, Icon: LuVideo },
            { id: "cameras", label: "Cameras", to: paths.cameras, Icon: LuMonitor },
            { id: "layouts", label: "Layouts", to: paths.layouts, Icon: LuLayoutGrid },
            { id: "archive", label: "Archive", to: paths.archive, Icon: LuHistory },
        ],
    },
    {
        label: "System",
        items: [
            { id: "connections", label: "Connections", to: paths.connections, Icon: LuNetwork },
            { id: "settings", label: "Settings", to: paths.settings, Icon: LuSettings },
        ],
    },
];

export default function Sidebar({ activePage, onLogout, user }) {
    return (
        <aside className="sticky top-0 flex h-dvh w-14 shrink-0 flex-col overflow-y-auto border-r border-stone-200 bg-[var(--color-surface)] px-1.5 py-3 sm:w-16 sm:px-2 lg:w-52 lg:px-4 lg:py-6">
            <Link
                aria-label="Signal live dashboard"
                className="mb-5 flex min-h-10 items-center justify-center gap-2 text-[var(--color-clay-700)] lg:-translate-y-1 lg:mb-8 lg:ml-1 lg:justify-start"
                title="Signal live dashboard"
                to={paths.live}
            >
                <SignalLogo className="size-9 shrink-0" />
                <span className="hidden min-w-0 text-left lg:block">
                    <span className="block whitespace-nowrap text-sm font-bold tracking-[0.3em] text-stone-900">SIGNAL</span>
                    <span className="mt-0.5 block whitespace-nowrap text-xs font-medium tracking-wide text-stone-500">RTSP STREAM VIEWER</span>
                </span>
            </Link>

            <nav aria-label="Main navigation" className="flex flex-col gap-4 lg:gap-6">
                {groups.map((group, groupIndex) => (
                    <div
                        className={groupIndex > 0 ? "border-t border-stone-200 pt-4 lg:pt-5" : ""}
                        key={group.label}
                    >
                        <p className="mb-2 hidden px-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400 lg:block">
                            {group.label}
                        </p>
                        <div className="flex flex-col gap-1">
                            {group.items.map(({ id, label, to, Icon }) => {
                                return (
                                    <NavLink
                                        aria-current={activePage === id ? "page" : undefined}
                                        className={({ isActive }) => `relative flex min-h-10 items-center justify-center gap-2 px-2 text-sm transition-colors lg:justify-start ${isActive || activePage === id
                                            ? "rounded-lg border-l-4 border-[var(--color-forest-800)] bg-[var(--color-forest-200)] font-semibold text-stone-900"
                                            : "rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                                            }`}
                                        key={id}
                                        title={label}
                                        to={to}
                                    >
                                        <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                                        <span className="sr-only lg:not-sr-only">{label}</span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="mt-auto hidden border-t border-stone-200 pt-4 lg:block">
                <div className="flex items-center gap-2">
                    <span className="brand-gradient flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{user?.full_name?.[0]?.toUpperCase() || "S"}</span>
                    <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-stone-800">{user?.full_name || "Signal user"}</span>
                        <span className="block truncate text-xs text-stone-500">{user?.email}</span>
                    </span>
                </div>
                <button className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900" onClick={onLogout} type="button">
                    <LuLogOut aria-hidden="true" className="size-4" />
                    Sign out
                </button>
            </div>
        </aside>
    );
}
