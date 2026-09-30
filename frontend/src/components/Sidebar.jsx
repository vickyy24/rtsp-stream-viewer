import {
    LuHistory,
    LuLayoutGrid,
    LuMonitor,
    LuNetwork,
    LuSettings,
    LuVideo,
} from "react-icons/lu";
import SignalLogo from "./SignalLogo.jsx";

const groups = [
    {
        label: "Workspace",
        items: [
            { id: "live", label: "Live", Icon: LuVideo },
            { id: "cameras", label: "Cameras", Icon: LuMonitor },
            { id: "layouts", label: "Layouts", Icon: LuLayoutGrid },
            { id: "archive", label: "Archive", Icon: LuHistory },
        ],
    },
    {
        label: "System",
        items: [
            { id: "connections", label: "Connections", Icon: LuNetwork },
            { id: "settings", label: "Settings", Icon: LuSettings },
        ],
    },
];

export default function Sidebar({ activePage, onNavigate }) {
    return (
        <aside className="sticky top-0 flex h-dvh w-14 shrink-0 flex-col overflow-y-auto border-r border-stone-200 bg-[var(--color-surface)] px-1.5 py-3 sm:w-16 sm:px-2 lg:w-56 lg:px-4 lg:py-6">
            <button
                aria-label="Signal live dashboard"
                className="mb-5 flex min-h-10 items-center justify-center gap-2 text-[var(--color-clay-700)] lg:mb-8 lg:justify-start"
                onClick={() => onNavigate("live")}
                title="Signal live dashboard"
                type="button"
            >
                <SignalLogo className="size-8 shrink-0" />
                <span className="hidden min-w-0 text-left lg:block">
                    <span className="block whitespace-nowrap text-[11px] font-bold tracking-[0.28em] text-stone-900">SIGNAL</span>
                    <span className="mt-0.5 block whitespace-nowrap text-[6px] font-medium tracking-wide text-stone-500">RTSP STREAM VIEWER</span>
                </span>
            </button>

            <nav aria-label="Main navigation" className="flex flex-col gap-4 lg:gap-6">
                {groups.map((group, groupIndex) => (
                    <div
                        className={groupIndex > 0 ? "border-t border-stone-200 pt-4 lg:pt-5" : ""}
                        key={group.label}
                    >
                        <p className="mb-2 hidden px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-400 lg:block">
                            {group.label}
                        </p>
                        <div className="flex flex-col gap-1">
                            {group.items.map(({ id, label, Icon }) => {
                                const selected = id === activePage
                                    || (id === "live" && activePage === "single-camera");
                                return (
                                    <button
                                        aria-current={selected ? "page" : undefined}
                                        className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-xs transition-colors lg:justify-start ${selected
                                            ? "bg-[var(--color-clay-50)] font-semibold text-[var(--color-clay-700)]"
                                            : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                                            }`}
                                        key={id}
                                        onClick={() => onNavigate(id)}
                                        title={label}
                                        type="button"
                                    >
                                        <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                                        <span className="sr-only lg:not-sr-only">{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="mt-auto hidden border-t border-stone-200 pt-4 lg:block">
                <div className="flex items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-clay-500)] text-xs font-semibold text-white">S</span>
                    <span className="min-w-0">
                        <span className="block truncate text-[11px] font-semibold text-stone-800">Signal</span>
                        <span className="block truncate text-[10px] text-stone-500">Stream workspace</span>
                    </span>
                </div>
            </div>
        </aside>
    );
}
