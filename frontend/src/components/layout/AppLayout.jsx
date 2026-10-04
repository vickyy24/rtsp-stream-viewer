export default function AppLayout({ children, fillContent = false, header, liveContent, showLive, sidebar }) {
    return (
        <div className="flex h-dvh min-h-0 overflow-hidden bg-[var(--color-app-background)] text-stone-900">
            {sidebar}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {header}
                <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 pb-3 pt-2">
                    <div className={`mx-auto flex min-w-0 w-full max-w-[1800px] flex-col gap-4 ${fillContent ? "h-full" : ""}`}>
                        <div hidden={!showLive}>{liveContent}</div>
                        <div className={fillContent ? "h-full" : ""} hidden={showLive}>{children}</div>
                    </div>
                </main>
            </div>
        </div>
    );
}
