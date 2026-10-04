import { LuExpand, LuLayoutGrid, LuPlus, LuCamera } from "react-icons/lu";

export default function DashboardToolbar({
    frameAvailable,
    isFullscreen,
    layout,
    onLayoutChange,
    onAddCamera,
    onSnapshot,
    onToggleFullscreen,
    streams,
}) {
    return (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200/80 bg-[var(--color-surface)] p-2.5">
            <div className="flex items-center gap-2 px-1 text-sm font-semibold text-stone-700">
                <LuLayoutGrid aria-hidden="true" className="size-4" />
                Layout
            </div>
            <div aria-label="Camera grid layout" className="flex flex-wrap gap-1.5" role="group">
                {["1x1", "2x2", "3x3", "4x4"].map((value) => (
                    <button
                        aria-pressed={layout === value}
                        className={`min-w-12 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors ${layout === value
                            ? "border-[var(--color-forest-700)] bg-[var(--color-forest-200)] text-[var(--color-forest-900)]"
                            : "border-stone-200 text-stone-600 hover:bg-stone-50"
                            }`}
                        key={value}
                        onClick={() => onLayoutChange(value)}
                        type="button"
                    >
                        {value}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                <ToolbarButton className="col-span-2 sm:col-span-1" disabled={!streams.length} icon={LuExpand} label={isFullscreen ? "Exit full" : "Fullscreen"} onClick={onToggleFullscreen} />
                <ToolbarButton disabled={!frameAvailable} icon={LuCamera} label="Snapshot" onClick={onSnapshot} />
                <ToolbarButton icon={LuPlus} label="Add camera" onClick={onAddCamera} primary />
            </div>
        </div>
    );
}

function ToolbarButton({ icon: Icon, label, onClick, disabled, primary = false, className = "" }) {
    return (
        <button
            className={`${primary ? "brand-gradient h-10 rounded-lg px-3.5 font-semibold" : "min-h-9 rounded-md border border-stone-200 bg-white/70 px-2.5 font-medium text-stone-700 hover:bg-stone-50"} ${className} inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45`}
            disabled={disabled}
            onClick={onClick}
            type="button"
        >
            <Icon aria-hidden="true" className="size-4" />
            <span>{label}</span>
        </button>
    );
}
