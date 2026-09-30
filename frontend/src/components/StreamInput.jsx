import { LuPlus } from "react-icons/lu";

export default function StreamInput({
    accessKey,
    error,
    onAccessKeyChange,
    onSubmit,
    onUrlChange,
    streamUrl,
}) {
    return (
        <section
            aria-labelledby="add-camera-heading"
            className="rounded-2xl border border-stone-200 bg-[var(--color-surface)] p-5 shadow-sm shadow-stone-200/40 sm:p-6"
        >
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h2 id="add-camera-heading" className="text-base font-semibold text-stone-900">
                        Add a camera
                    </h2>
                    <p className="mt-1 text-sm text-stone-500">
                        Paste an RTSP address to add it to your workspace.
                    </p>
                </div>
                <form className="grid w-full gap-2 sm:grid-cols-2 md:max-w-3xl" onSubmit={onSubmit}>
                    <label className="sr-only" htmlFor="stream-url">RTSP stream URL</label>
                    <input
                        autoComplete="off"
                        className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-[var(--color-canvas-soft)] px-4 py-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-[var(--color-olive-600)] focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-forest-100)]"
                        id="stream-url"
                        onChange={(event) => onUrlChange(event.target.value)}
                        placeholder="rtsp://camera-address:554/stream"
                        type="url"
                        value={streamUrl}
                    />
                    <label className="sr-only" htmlFor="stream-access-key">Workspace access key</label>
                    <input
                        autoComplete="off"
                        className="min-w-0 rounded-xl border border-stone-200 bg-[var(--color-canvas-soft)] px-4 py-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-[var(--color-olive-600)] focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-forest-100)]"
                        id="stream-access-key"
                        onChange={(event) => onAccessKeyChange(event.target.value)}
                        placeholder="Workspace access key (hosted)"
                        type="password"
                        value={accessKey}
                    />
                    <button
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--color-forest-800)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-forest-900)] focus:outline-none focus:ring-4 focus:ring-[var(--color-forest-200)] sm:col-span-2 sm:justify-self-end"
                        type="submit"
                    >
                        <LuPlus aria-hidden="true" className="size-4" />
                        Add camera
                    </button>
                </form>
            </div>
            {error && (
                <p className="mt-3 text-sm font-medium text-rose-600" role="alert">{error}</p>
            )}
            <p className="mt-3 text-xs text-stone-400">
                Camera addresses and the workspace key stay in memory and aren’t displayed on camera cards.
            </p>
        </section>
    );
}
