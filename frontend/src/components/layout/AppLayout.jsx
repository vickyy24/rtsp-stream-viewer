export default function AppLayout({ children, header, liveContent, showLive, sidebar }) {
    return (
        <div className="flex h-dvh min-h-0 overflow-hidden bg-[var(--color-app-background)] text-stone-900">
            {sidebar}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {header}
                <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2">
                    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
                        <div hidden={!showLive}>{liveContent}</div>
                        <div hidden={showLive}>{children}</div>
                    </div>
                </main>
            </div>
        </div>
    );
}
