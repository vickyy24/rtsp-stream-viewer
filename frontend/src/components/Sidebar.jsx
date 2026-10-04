import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import {
    LuChevronLeft,
    LuChevronRight,
    LuHistory,
    LuLayoutGrid,
    LuLogOut,
    LuMonitor,
    LuNetwork,
    LuSettings,
    LuVideo,
    LuX,
} from "react-icons/lu";
import SignalLogo from "./SignalLogo.jsx";

const groups = [
    {
        label: "Workspace",
        items: [
            { id: "live", label: "Live", to: "/live", Icon: LuVideo },
            { id: "cameras", label: "Cameras", to: "/cameras", Icon: LuMonitor },
            { id: "layouts", label: "Layouts", to: "/layouts", Icon: LuLayoutGrid },
            { id: "archive", label: "Archive", to: "/archive", Icon: LuHistory },
        ],
    },
    {
        label: "System",
        items: [
            { id: "connections", label: "Connections", to: "/connections", Icon: LuNetwork },
            { id: "settings", label: "Settings", to: "/settings", Icon: LuSettings },
        ],
    },
];

function SidebarContent({ activePage, expanded, isDrawer = false, onLogout, onNavigate, onToggle, user }) {
    const labelClass = isDrawer ? "block" : expanded ? "hidden lg:block" : "sr-only";

    return (
        <>
            <Link
                aria-label="Signal live dashboard"
                className={`mb-3 flex min-h-10 items-center justify-center gap-2 text-[var(--color-clay-700)] ${expanded && !isDrawer ? "lg:justify-start" : ""}`}
                title="Signal live dashboard"
                to="/live"
                onClick={onNavigate}
            >
                <SignalLogo className="size-9 shrink-0" />
                <span className={`${labelClass} min-w-0 text-left`}>
                    <span className="block whitespace-nowrap text-sm font-bold tracking-[0.3em] text-stone-900">SIGNAL</span>
                    <span className="mt-0.5 block whitespace-nowrap text-xs font-medium tracking-wide text-stone-500">RTSP STREAM VIEWER</span>
                </span>
            </Link>

            {!isDrawer && (
                <button
                    aria-expanded={expanded}
                    aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
                    className={`mb-3 flex size-9 shrink-0 items-center justify-center self-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-700)] ${expanded ? "lg:self-end" : ""}`}
                    onClick={onToggle}
                    title={expanded ? "Collapse sidebar" : "Expand sidebar"}
                    type="button"
                >
                    {expanded
                        ? <LuChevronLeft aria-hidden="true" className="size-[18px]" />
                        : <LuChevronRight aria-hidden="true" className="size-[18px]" />}
                </button>
            )}

            {isDrawer && (
                <button
                    aria-label="Close navigation"
                    className="mb-3 flex size-9 shrink-0 items-center justify-center self-end rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-700)]"
                    onClick={onToggle}
                    type="button"
                >
                    <LuX aria-hidden="true" className="size-[18px]" />
                </button>
            )}

            <nav aria-label="Main navigation" className="flex flex-col gap-4 lg:gap-6">
                {groups.map((group, groupIndex) => (
                    <div
                        className={groupIndex > 0 ? "border-t border-stone-200 pt-4 lg:pt-5" : ""}
                        key={group.label}
                    >
                        <p className={`${labelClass} mb-2 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400`}>
                            {group.label}
                        </p>
                        <div className="flex flex-col gap-1">
                            {group.items.map(({ id, label, to, Icon }) => {
                                return (
                                    <NavLink
                                        aria-current={activePage === id ? "page" : undefined}
                                        className={({ isActive }) => `relative flex min-h-10 items-center gap-2 px-2 text-sm transition-colors ${isDrawer ? "justify-start" : expanded ? "justify-center lg:justify-start" : "justify-center"} ${isActive || activePage === id
                                            ? "rounded-lg border-l-4 border-[var(--color-forest-800)] bg-[var(--color-forest-200)] font-semibold text-stone-900"
                                            : "rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                                            }`}
                                        key={id}
                                        title={label}
                                        to={to}
                                        onClick={onNavigate}
                                    >
                                        <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                                        <span className={labelClass}>{label}</span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className={`mt-auto border-t border-stone-200 pt-4 ${isDrawer ? "" : expanded ? "hidden lg:block" : "hidden"}`}>
                <button className="mb-3 flex min-h-11 w-full items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2" onClick={onLogout} type="button">
                    <LuLogOut aria-hidden="true" className="size-[18px] shrink-0 stroke-[2.4]" />
                    Log out
                </button>
                <div className="flex items-center gap-2">
                    <span className="brand-gradient flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{user?.full_name?.[0]?.toUpperCase() || "S"}</span>
                    <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-stone-800">{user?.full_name || "Signal user"}</span>
                        <span className="block truncate text-xs text-stone-500">{user?.email}</span>
                    </span>
                </div>
            </div>
        </>
    );
}

export default function Sidebar({ activePage, onLogout, user }) {
    const [expanded, setExpanded] = useState(() => window.matchMedia("(min-width: 1024px)").matches);

    useEffect(() => {
        const breakpoint = window.matchMedia("(min-width: 1024px)");
        const handleBreakpointChange = (event) => setExpanded(event.matches);
        breakpoint.addEventListener("change", handleBreakpointChange);
        return () => breakpoint.removeEventListener("change", handleBreakpointChange);
    }, []);

    function handleNavigate() {
        if (!window.matchMedia("(min-width: 1024px)").matches) setExpanded(false);
    }

    function handleLogout() {
        setExpanded(false);
        onLogout();
    }

    return (
        <>
            <aside className={`sticky top-0 z-30 flex h-dvh shrink-0 flex-col overflow-y-auto border-r border-stone-200 bg-[var(--color-surface)] py-3 transition-[width,padding] duration-200 ${expanded ? "w-14 px-1.5 sm:w-16 sm:px-2 lg:w-52 lg:px-4 lg:py-6" : "w-14 px-1.5 sm:w-16 sm:px-2 lg:w-16 lg:px-2 lg:py-6"}`}>
                <SidebarContent
                    activePage={activePage}
                    expanded={expanded}
                    onLogout={handleLogout}
                    onNavigate={handleNavigate}
                    onToggle={() => setExpanded((current) => !current)}
                    user={user}
                />
            </aside>

            {expanded && (
                <>
                    <button
                        aria-label="Close navigation"
                        className="fixed inset-0 z-40 bg-stone-950/35 lg:hidden"
                        onClick={() => setExpanded(false)}
                        type="button"
                    />
                    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-stone-200 bg-[var(--color-surface)] px-4 py-4 shadow-xl lg:hidden">
                        <SidebarContent
                            activePage={activePage}
                            expanded
                            isDrawer
                            onLogout={handleLogout}
                            onNavigate={handleNavigate}
                            onToggle={() => setExpanded(false)}
                            user={user}
                        />
                    </aside>
                </>
            )}
        </>
    );
}
