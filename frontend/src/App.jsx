function App() {
    return (
        <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-8 sm:py-10">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
                <header className="flex flex-col justify-between gap-5 border-b border-slate-800 pb-6 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-sm font-medium uppercase tracking-[0.18em] text-sky-400">
                            RTSP MONITOR
                        </p>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                            Stream viewer
                        </h1>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                            Your live camera feeds, together in one workspace.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 self-start rounded-full border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 sm:self-auto">
                        <span className="size-2 rounded-full bg-slate-500" />
                        Ready to connect
                    </div>
                </header>

                <section
                    aria-labelledby="streams-heading"
                    className="flex flex-col gap-5"
                >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                        <div>
                            <h2
                                id="streams-heading"
                                className="text-lg font-semibold"
                            >
                                Live streams
                            </h2>
                            <p className="mt-1 text-sm text-slate-400">
                                Add a camera to start building your live view.
                            </p>
                        </div>
                        <span className="text-sm text-slate-400">0 streams</span>
                    </div>

                    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-12 text-center">
                        <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-sky-400">
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                fill="none"
                                className="size-6"
                            >
                                <path
                                    d="M4 7.75A2.75 2.75 0 0 1 6.75 5h7.5A2.75 2.75 0 0 1 17 7.75v8.5A2.75 2.75 0 0 1 14.25 19h-7.5A2.75 2.75 0 0 1 4 16.25v-8.5ZM17 9l3-2v10l-3-2"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                        <h3 className="text-base font-semibold">No streams yet</h3>
                        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
                            Your connected camera feeds will appear here in a
                            responsive grid.
                        </p>
                        <span className="mt-5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-400">
                            Stream input coming next
                        </span>
                    </div>
                </section>
            </div>
        </main>
    );
}

export default App;
