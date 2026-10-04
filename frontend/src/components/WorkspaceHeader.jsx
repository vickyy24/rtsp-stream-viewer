import { useEffect, useState } from "react";
import { Link } from "react-router";
import { LuBell, LuMaximize, LuMenu, LuSearch } from "react-icons/lu";

function useClock() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const intervalId = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(intervalId);
    }, []);

    return now;
}

export default function WorkspaceHeader({ onMenuClick, onSearchChange, searchValue, user }) {
    const now = useClock();
    const displayName = user?.full_name?.trim() || user?.email || "Signal user";
    const initials = displayName
        .split(/[\s@._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "S";

    async function toggleFullscreen() {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await document.documentElement.requestFullscreen();
        }
    }

    return (
        <header className="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-stone-200 bg-[var(--color-surface)] px-3 py-3 sm:gap-4">
            <button
                aria-label="Open navigation"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 shadow-sm transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-700)] lg:hidden"
                onClick={onMenuClick}
                type="button"
            >
                <LuMenu aria-hidden="true" className="size-5" />
            </button>
            <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-stone-200 bg-white/70 px-3 py-2 sm:max-w-sm">
                    <LuSearch aria-hidden="true" className="size-4 shrink-0 text-stone-400" />
                    <span className="sr-only">Search cameras</span>
                    <input
                        className="min-w-0 flex-1 bg-transparent text-sm text-stone-700 outline-none placeholder:text-stone-400"
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search cameras, locations…"
                        type="search"
                        value={searchValue}
                    />
            </label>

            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                <div className="hidden text-right min-[420px]:block">
                    <p className="text-xs text-stone-400">
                        {new Intl.DateTimeFormat(undefined, {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                        }).format(now)}
                    </p>
                    <p className="text-xs font-semibold text-stone-700">
                        {new Intl.DateTimeFormat(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                        }).format(now)}
                    </p>
                </div>
                <Link
                    aria-label={`Account settings for ${displayName}`}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest-700)] text-xs font-semibold text-white ring-2 ring-[var(--color-forest-100)] transition hover:ring-[var(--color-forest-200)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-700)] focus-visible:ring-offset-2"
                    title={displayName}
                    to="/settings"
                >
                    {initials}
                </Link>
                <span
                    aria-label="Notifications are not configured"
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-stone-400"
                    title="Notifications are not configured"
                >
                    <LuBell aria-hidden="true" className="size-[18px]" />
                </span>
                <button
                    aria-label="Toggle fullscreen"
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
                    onClick={toggleFullscreen}
                    type="button"
                >
                    <LuMaximize aria-hidden="true" className="size-[18px]" />
                </button>
            </div>
        </header>
    );
}
