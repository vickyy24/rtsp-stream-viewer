import { useEffect, useState } from "react";
import { LuBell, LuMaximize, LuSearch } from "react-icons/lu";

function useClock() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const intervalId = window.setInterval(() => setNow(new Date()), 30000);
        return () => window.clearInterval(intervalId);
    }, []);

    return now;
}

export default function WorkspaceHeader({
    onSearchChange,
    searchValue,
    title,
}) {
    const now = useClock();

    async function toggleFullscreen() {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await document.documentElement.requestFullscreen();
        }
    }

    return (
        <header className="flex flex-col gap-4 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="hidden min-w-0 sm:block">
                    <p className="truncate text-xs text-stone-400">Workspace / {title}</p>
                    <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-stone-900">
                        {title}
                    </h1>
                </div>
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-stone-200 bg-[var(--color-surface)] px-3 py-2 sm:max-w-sm">
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
            </div>

            <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="text-right">
                    <p className="text-[10px] text-stone-400">
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
                <span
                    aria-label="Notifications are not configured"
                    className="flex size-9 items-center justify-center rounded-lg text-stone-400"
                    title="Notifications are not configured"
                >
                    <LuBell aria-hidden="true" className="size-[18px]" />
                </span>
                <button
                    aria-label="Toggle fullscreen"
                    className="hidden size-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 sm:flex"
                    onClick={toggleFullscreen}
                    type="button"
                >
                    <LuMaximize aria-hidden="true" className="size-[18px]" />
                </button>
                <span
                    aria-label="Signal workspace"
                    className="flex size-8 items-center justify-center rounded-full bg-[var(--color-clay-500)] text-xs font-semibold text-white"
                >
                    S
                </span>
            </div>
        </header>
    );
}
