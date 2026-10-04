import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import {
    LuHistory,
    LuLayoutGrid,
    LuLogOut,
    LuMenu,
    LuMonitor,
    LuNetwork,
    LuPanelLeftClose,
    LuPanelLeftOpen,
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

function SidebarContents({ activePage, expanded, isDrawer = false, isMobile = false, mobileOpen = false, onLogout, onNavigate, onToggle, user }) {
    const ToggleIcon = isDrawer
        ? LuX
        : expanded ? LuPanelLeftClose : LuPanelLeftOpen;
    const toggleLabel = isDrawer
        ? "Close navigation"
        : isMobile ? "Open navigation" : expanded ? "Collapse sidebar" : "Expand sidebar";

    return (
        <>
            <div className={`mb-5 flex min-w-0 items-center gap-2 ${isDrawer || expanded ? "justify-between" : "justify-center"}`}>
                <Link
                    aria-label="Signal live dashboard"
                    className={`-translate-y-2 flex min-h-10 min-w-0 items-center gap-1.5 text-[var(--color-clay-700)] ${expanded || isDrawer ? "flex-1 justify-start" : "hidden"}`}
                    onClick={onNavigate}
                    title="Signal live dashboard"
                    to="/live"
                >
                    <SignalLogo className="size-10 shrink-0" />
                    <span className={`${isDrawer ? "block" : expanded ? "hidden lg:block" : "hidden"} min-w-0 flex-1 text-left`}>
                        <span className="block truncate whitespace-nowrap text-sm font-bold tracking-[0.12em] text-stone-900">SIGNAL</span>
                        <span className="mt-0.5 block truncate whitespace-nowrap text-[10px] font-medium tracking-tight text-stone-500">RTSP STREAM VIEWER</span>
                    </span>
                </Link>

                <button
                    aria-expanded={isDrawer ? true : isMobile ? mobileOpen : expanded}
                    aria-label={toggleLabel}
                    className={`flex shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 shadow-sm transition hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-700)] ${expanded || isDrawer ? "size-8" : "size-7"}`}
                    onClick={onToggle}
                    title={toggleLabel}
                    type="button"
                >
                    {isDrawer
                        ? <ToggleIcon aria-hidden="true" className="size-[18px]" />
                        : (
                            <>
                                <ToggleIcon aria-hidden="true" className="hidden size-[18px] lg:block" />
                                <LuMenu aria-hidden="true" className="size-4 lg:hidden" />
                            </>
                        )}
                </button>
            </div>

            <nav aria-label="Main navigation" className="flex flex-col gap-4 lg:gap-6">
                {groups.map((group, groupIndex) => (
                    <div
                        className={groupIndex > 0 ? "border-t border-stone-200 pt-4 lg:pt-5" : ""}
                        key={group.label}
                    >
                        <p className={`${isDrawer ? "block" : expanded ? "hidden lg:block" : "hidden"} mb-2 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400`}>
                            {group.label}
                        </p>
                        <div className="flex flex-col gap-1">
                            {group.items.map(({ id, label, to, Icon }) => (
                                <NavLink
                                    aria-current={activePage === id ? "page" : undefined}
                                    className={({ isActive }) => `relative flex min-h-10 items-center gap-2 px-2 text-sm transition-colors ${isDrawer ? "justify-start" : expanded ? "justify-center lg:justify-start" : "justify-center"} ${isActive || activePage === id
                                        ? "rounded-lg border-l-4 border-[var(--color-forest-800)] bg-[var(--color-forest-200)] font-semibold text-stone-900"
                                        : "rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                                        }`}
                                    key={id}
                                    onClick={onNavigate}
                                    title={label}
                                    to={to}
                                >
                                    <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                                    <span className={isDrawer ? "" : expanded ? "sr-only lg:not-sr-only" : "sr-only"}>{label}</span>
                                </NavLink>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            <div className={isDrawer
                ? "mt-auto border-t border-stone-200 pt-4"
                : expanded ? "mt-auto hidden border-t border-stone-200 pt-4 lg:block" : "hidden"}>
                <button className="mb-3 flex min-h-11 w-full items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2" onClick={onLogout} type="button">
                    <LuLogOut aria-hidden="true" className="size-[18px] shrink-0 stroke-[2.4]" />
                    <span>Log out</span>
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

export default function Sidebar({ activePage, mobileOpen, onLogout, onMobileOpenChange, user }) {
    const [expanded, setExpanded] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
    const [isMobile, setIsMobile] = useState(() => !window.matchMedia("(min-width: 1024px)").matches);

    useEffect(() => {
        const breakpoint = window.matchMedia("(min-width: 1024px)");
        const handleBreakpointChange = (event) => {
            setIsMobile(!event.matches);
            setExpanded(event.matches);
            onMobileOpenChange(false);
        };
        breakpoint.addEventListener("change", handleBreakpointChange);
        return () => breakpoint.removeEventListener("change", handleBreakpointChange);
    }, [onMobileOpenChange]);

    function handleNavigate() {
        if (!window.matchMedia("(min-width: 1024px)").matches) onMobileOpenChange(false);
    }

    function handleLogout() {
        onMobileOpenChange(false);
        onLogout();
    }

    return (
        <>
            <aside className={`sticky top-0 z-30 hidden h-dvh shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-stone-200 bg-[var(--color-surface)] py-3 transition-[width,padding] duration-200 lg:flex ${expanded ? "w-52 px-3 py-6" : "w-16 px-0.5 py-6"}`}>
                <SidebarContents
                    activePage={activePage}
                    expanded={expanded}
                    onLogout={handleLogout}
                    onNavigate={handleNavigate}
                    onToggle={() => {
                        setExpanded((current) => !current);
                    }}
                    user={user}
                />
            </aside>

            {isMobile && mobileOpen && (
                <>
                    <button
                        aria-label="Close navigation"
                        className="fixed inset-0 z-40 bg-stone-950/35"
                        onClick={() => onMobileOpenChange(false)}
                        type="button"
                    />
                    <aside aria-label="Navigation drawer" className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-stone-200 bg-[var(--color-surface)] px-4 py-4 shadow-xl">
                        <SidebarContents
                            activePage={activePage}
                            expanded
                            isDrawer
                            onLogout={handleLogout}
                            onNavigate={handleNavigate}
                            onToggle={() => onMobileOpenChange(false)}
                            user={user}
                        />
                    </aside>
                </>
            )}
        </>
    );
}
