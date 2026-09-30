import { useCallback, useEffect, useState } from "react";

function CameraIcon({ className = "size-5" }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            viewBox="0 0 24 24"
            fill="none"
        >
            <path
                d="M4.75 7.5A2.75 2.75 0 0 1 7.5 4.75h7A2.75 2.75 0 0 1 17.25 7.5v9a2.75 2.75 0 0 1-2.75 2.75h-7a2.75 2.75 0 0 1-2.75-2.75v-9ZM17.25 9l3-2v10l-3-2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function NavItem({ active = false, children, icon }) {
    return (
        <button
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                active
                    ? "bg-forest-100 text-forest-700"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
            }`}
            type="button"
        >
            <span className="shrink-0">{icon}</span>
            {children}
            {active && (
                <span className="ml-auto size-1.5 rounded-full bg-olive-500" />
            )}
        </button>
    );
}

function Sidebar() {
    return (
        <aside className="flex w-full shrink-0 flex-col border-b border-stone-200 bg-paper px-5 py-4 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r lg:px-5 lg:py-7">
            <a
                className="flex items-center gap-3 px-1"
                href="#main-content"
                aria-label="Frame home"
            >
                <span className="flex size-10 items-center justify-center rounded-xl bg-forest-800 text-white shadow-sm shadow-forest-200">
                    <CameraIcon className="size-5" />
                </span>
                <span>
                    <span className="block text-[15px] font-semibold tracking-tight text-stone-900">
                        Frame
                    </span>
                    <span className="block text-xs text-stone-400">
                        CAMERA WORKSPACE
                    </span>
                </span>
            </a>

            <div className="mt-8 hidden lg:block">
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-stone-400">
                    Workspace
                </p>
                <nav aria-label="Main navigation" className="flex flex-col gap-1">
                    <NavItem active icon={<CameraIcon />}>Live view</NavItem>
                    <NavItem
                        icon={
                            <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
                                <path d="M5 6.75A1.75 1.75 0 0 1 6.75 5h10.5A1.75 1.75 0 0 1 19 6.75v10.5A1.75 1.75 0 0 1 17.25 19H6.75A1.75 1.75 0 0 1 5 17.25V6.75ZM9 5v14m6-14v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        }
                    >
                        Layouts
                    </NavItem>
                    <NavItem
                        icon={
                            <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
                                <path d="M12 3.75 14.5 9l5.75.75-4.25 4 .98 5.75L12 16.75l-4.98 2.75.98-5.75-4.25-4L9.5 9 12 3.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                            </svg>
                        }
                    >
                        Favorites
                    </NavItem>
                </nav>
            </div>

            <div className="mt-5 flex items-center justify-between lg:hidden">
                <span className="text-xs font-medium text-stone-400">YOUR WORKSPACE</span>
                <span className="flex items-center gap-2 text-xs font-medium text-olive-700">
                    <span className="size-2 rounded-full bg-olive-500" />
                    Local workspace
                </span>
            </div>

            <div className="mt-auto hidden rounded-2xl border border-stone-200 bg-stone-50 p-4 lg:block">
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                    <span className="size-2 rounded-full bg-olive-500" />
                    Workspace ready
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-500">
                    Your camera connections will appear here when added.
                </p>
            </div>
        </aside>
    );
}

function StreamCard({ stream, index, onStatusChange, onRetry, onToggle, onRemove }) {
    const [status, setStatus] = useState(stream.playing ? "connecting" : "paused");
    const [frameUrl, setFrameUrl] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!stream.playing) {
            setStatus("paused");
            setMessage("");
            return undefined;
        }

        let currentFrameUrl = "";
        let closeRequested = false;
        let errorReported = false;
        let keepAliveInterval;
        const configuredUrl = import.meta.env.VITE_STREAM_WS_URL;
        const socketUrl = configuredUrl || `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.hostname}:8000/ws/streams/`;
        const socket = new WebSocket(socketUrl);
        socket.binaryType = "blob";
        setStatus("connecting");
        setMessage("");
        onStatusChange(stream.id, "connecting");

        socket.onopen = () => {
            if (closeRequested) return;
            socket.send(JSON.stringify({ type: "authenticate", key: stream.accessKey }));
            keepAliveInterval = window.setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: "ping" }));
                }
            }, 5 * 60 * 1000);
        };
        socket.onmessage = (event) => {
            if (closeRequested) return;
            if (typeof event.data !== "string") {
                const nextUrl = URL.createObjectURL(event.data);
                if (currentFrameUrl) URL.revokeObjectURL(currentFrameUrl);
                currentFrameUrl = nextUrl;
                setFrameUrl(nextUrl);
                return;
            }

            let payload;
            try {
                payload = JSON.parse(event.data);
            } catch {
                return;
            }
            if (payload.type === "status") {
                setStatus(payload.status);
                onStatusChange(stream.id, payload.status);
            } else if (payload.type === "authenticated") {
                socket.send(JSON.stringify({ type: "start", url: stream.url }));
            } else if (payload.type === "error") {
                errorReported = true;
                window.clearInterval(keepAliveInterval);
                setStatus("error");
                setMessage(payload.message || "The camera could not be reached.");
                onStatusChange(stream.id, "error");
            }
        };
        socket.onerror = () => {
            if (closeRequested) return;
            errorReported = true;
            window.clearInterval(keepAliveInterval);
            setStatus("error");
            setMessage("Could not reach the stream service. Check that the backend is running.");
            onStatusChange(stream.id, "error");
        };
        socket.onclose = () => {
            window.clearInterval(keepAliveInterval);
            if (currentFrameUrl) URL.revokeObjectURL(currentFrameUrl);
            if (!closeRequested && !errorReported) {
                setStatus("error");
                setMessage("The connection to the camera service was closed.");
                onStatusChange(stream.id, "error");
            }
        };

        return () => {
            closeRequested = true;
            window.clearInterval(keepAliveInterval);
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "stop" }));
            }
            socket.close();
            if (currentFrameUrl) URL.revokeObjectURL(currentFrameUrl);
            setFrameUrl("");
        };
    }, [stream.accessKey, stream.id, stream.playing, stream.retryCount, stream.url, onStatusChange]);

    const statusLabel = {
        connecting: "Connecting",
        live: "Live",
        error: "Connection issue",
        paused: "Paused",
        stopped: "Paused",
    }[status] || "Connecting";

    return (
        <article className="overflow-hidden rounded-2xl border border-stone-200 bg-paper shadow-sm shadow-stone-200/50">
            <div className="camera-preview relative flex aspect-video items-center justify-center bg-stone-100">
                {frameUrl && status === "live" ? (
                    <img
                        alt={`Live feed from camera ${index + 1}`}
                        className="size-full object-contain"
                        src={frameUrl}
                    />
                ) : (
                    <div className="flex max-w-sm flex-col items-center px-5 text-center text-stone-400">
                        <CameraIcon className="size-8" />
                        <span className="mt-3 max-w-xs text-xs font-medium leading-5">
                            {message || (status === "connecting" ? "Connecting to camera…" : status === "error" ? "Camera connection failed" : "Camera paused")}
                        </span>
                        {status === "error" && (
                            <button
                                className="mt-3 text-xs font-semibold text-forest-700 hover:text-forest-900"
                                onClick={onRetry}
                                type="button"
                            >
                                Retry connection
                            </button>
                        )}
                    </div>
                )}
                <span className="absolute left-3 top-3 rounded-full border border-white/80 bg-paper/90 px-2.5 py-1 text-[11px] font-semibold text-stone-600 shadow-sm">
                    CAMERA {String(index + 1).padStart(2, "0")}
                </span>
                <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-stone-200 bg-paper/90 px-2.5 py-1 text-[11px] font-medium text-stone-500 shadow-sm">
                    <span
                        className={`size-1.5 rounded-full ${status === "live" ? "bg-olive-500" : status === "error" ? "bg-rose-500" : "bg-stone-400"}`}
                    />
                    {statusLabel}
                </span>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-stone-800">Camera {index + 1}</h3>
                    <p className="mt-0.5 truncate text-xs text-stone-400">{stream.host}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        aria-label={`${stream.playing ? "Pause" : "Play"} camera ${index + 1}`}
                        className="flex size-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-forest-50 hover:text-forest-700"
                        onClick={onToggle}
                        type="button"
                    >
                        {stream.playing ? (
                            <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7 5h4v14H7zm6 0h4v14h-4z" />
                            </svg>
                        ) : (
                            <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11-7.2a.8.8 0 0 0 0-1.4l-11-7.2a.8.8 0 0 0-1.2.7Z" />
                            </svg>
                        )}
                    </button>
                    <button
                        aria-label={`Remove camera ${index + 1}`}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                        onClick={onRemove}
                        type="button"
                    >
                        <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
                            <path d="M5 7h14M10 11v6m4-6v6M6.5 7l.8 12h9.4l.8-12M9 7V4.75h6V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </div>
        </article>
    );
}

function App() {
    const [streamUrl, setStreamUrl] = useState("");
    const [accessKey, setAccessKey] = useState("");
    const [streams, setStreams] = useState([]);
    const [error, setError] = useState("");
    const [statuses, setStatuses] = useState({});

    const updateStatus = useCallback((streamId, status) => {
        setStatuses((current) => current[streamId] === status ? current : { ...current, [streamId]: status });
    }, []);

    function handleSubmit(event) {
        event.preventDefault();
        setError("");

        let parsedUrl;
        try {
            parsedUrl = new URL(streamUrl.trim());
        } catch {
            setError("Enter a valid RTSP camera address.");
            return;
        }

        if (!["rtsp:", "rtsps:"].includes(parsedUrl.protocol)) {
            setError("Camera addresses must start with rtsp:// or rtsps://.");
            return;
        }

        setStreams((currentStreams) => [
            ...currentStreams,
            {
                id: crypto.randomUUID(),
                url: streamUrl.trim(),
                host: parsedUrl.hostname,
                accessKey,
                playing: true,
                retryCount: 0,
            },
        ]);
        setStreamUrl("");
    }

    function removeStream(streamId) {
        setStatuses((current) => {
            const { [streamId]: removed, ...remaining } = current;
            return remaining;
        });
        setStreams((currentStreams) =>
            currentStreams.filter((stream) => stream.id !== streamId),
        );
    }

    return (
        <div className="min-h-screen bg-canvas text-stone-900 lg:flex">
            <Sidebar />

            <main
                className="min-w-0 flex-1 px-4 py-6 sm:px-7 lg:px-10 lg:py-9"
                id="main-content"
            >
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
                    <header className="flex flex-col justify-between gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-center">
                        <div>
                            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-stone-400">
                                <span>Workspace</span>
                                <span aria-hidden="true">/</span>
                                <span className="text-stone-600">Live view</span>
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-[28px]">
                                Good to see you
                            </h1>
                            <p className="mt-1.5 text-sm text-stone-500">
                                Keep an eye on every camera, all in one place.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 self-start rounded-full border border-stone-200 bg-paper px-3.5 py-2 sm:self-auto">
                            <span className="relative flex size-2.5">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-clay-500 opacity-30" />
                                <span className="relative inline-flex size-2.5 rounded-full bg-olive-500" />
                            </span>
                            <span className="text-xs font-medium text-stone-600">Workspace online</span>
                        </div>
                    </header>

                    <section aria-label="Workspace summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-stone-200 bg-paper p-5 shadow-sm shadow-stone-200/40">
                            <p className="text-xs font-medium text-stone-500">Total cameras</p>
                            <div className="mt-3 flex items-end justify-between">
                                <span className="text-3xl font-semibold tracking-tight text-stone-900">{streams.length}</span>
                                <span className="mb-1 rounded-lg bg-forest-50 p-2 text-forest-600">
                                    <CameraIcon className="size-4" />
                                </span>
                            </div>
                            <p className="mt-2 text-xs text-stone-400">In this workspace</p>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-paper p-5 shadow-sm shadow-stone-200/40">
                            <p className="text-xs font-medium text-stone-500">Live now</p>
                            <div className="mt-3 flex items-end justify-between">
                                <span className="text-3xl font-semibold tracking-tight text-stone-900">{Object.values(statuses).filter((status) => status === "live").length}</span>
                                <span className="mb-1 rounded-lg bg-forest-50 p-2 text-olive-700">
                                    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
                                        <path d="M5 12h3l2-6 4 12 2-6h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </span>
                            </div>
                            <p className="mt-2 text-xs text-stone-400">Streams connected</p>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-paper p-5 shadow-sm shadow-stone-200/40">
                            <p className="text-xs font-medium text-stone-500">Workspace status</p>
                            <div className="mt-3 flex items-end justify-between">
                                <span className="text-xl font-semibold tracking-tight text-olive-700">Ready</span>
                                <span className="mb-1 rounded-lg bg-clay-50 p-2 text-clay-700">
                                    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 8v4m0 4h.01M10.3 4.9 2.8 18a1.4 1.4 0 0 0 1.2 2.1h16a1.4 1.4 0 0 0 1.2-2.1l-7.5-13.1a1.9 1.9 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </span>
                            </div>
                            <p className="mt-2 text-xs text-stone-400">Waiting for first stream</p>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-stone-200 bg-paper p-5 shadow-sm shadow-stone-200/40 sm:p-6" aria-labelledby="add-camera-heading">
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                            <div>
                                <h2 id="add-camera-heading" className="text-base font-semibold text-stone-900">Add a camera</h2>
                                <p className="mt-1 text-sm text-stone-500">Paste an RTSP address to add it to your workspace.</p>
                            </div>
                            <form className="grid w-full gap-2 sm:grid-cols-2 md:max-w-3xl" onSubmit={handleSubmit}>
                                <label className="sr-only" htmlFor="stream-url">RTSP stream URL</label>
                                <input
                                    autoComplete="off"
                                    className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-canvas-soft px-4 py-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-olive-600 focus:bg-paper focus:ring-4 focus:ring-forest-100"
                                    id="stream-url"
                                    onChange={(event) => setStreamUrl(event.target.value)}
                                    placeholder="rtsp://camera-address:554/stream"
                                    type="url"
                                    value={streamUrl}
                                />
                                <label className="sr-only" htmlFor="stream-access-key">Workspace access key</label>
                                <input
                                    autoComplete="off"
                                    className="min-w-0 rounded-xl border border-stone-200 bg-canvas-soft px-4 py-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-olive-600 focus:bg-paper focus:ring-4 focus:ring-forest-100"
                                    id="stream-access-key"
                                    onChange={(event) => setAccessKey(event.target.value)}
                                    placeholder="Workspace access key (hosted)"
                                    type="password"
                                    value={accessKey}
                                />
                                <button className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-forest-800 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-forest-200 transition hover:bg-forest-900 focus:outline-none focus:ring-4 focus:ring-forest-200 sm:col-span-2 sm:justify-self-end" type="submit">
                                    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                    </svg>
                                    Add camera
                                </button>
                            </form>
                        </div>
                        {error && (
                            <p className="mt-3 text-sm font-medium text-rose-600" role="alert">{error}</p>
                        )}
                        <p className="mt-3 text-xs text-stone-400">Camera addresses and the workspace key stay in memory and aren’t displayed on camera cards.</p>
                    </section>

                    <section aria-labelledby="streams-heading" className="flex flex-col gap-5">
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                            <div>
                                <h2 id="streams-heading" className="text-lg font-semibold tracking-tight text-stone-900">Your cameras</h2>
                                <p className="mt-1 text-sm text-stone-500">A clear view of every connected space.</p>
                            </div>
                            <span className="text-xs font-medium text-stone-500">{streams.length} {streams.length === 1 ? "camera" : "cameras"}</span>
                        </div>

                        {streams.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                {streams.map((stream, index) => (
                                    <StreamCard
                                        index={index}
                                        key={stream.id}
                                        stream={stream}
                                        onRemove={() => removeStream(stream.id)}
                                        onStatusChange={updateStatus}
                                        onRetry={() => setStreams((current) => current.map((item) => item.id === stream.id ? { ...item, accessKey, retryCount: item.retryCount + 1 } : item))}
                                        onToggle={() => setStreams((current) => current.map((item) => item.id === stream.id ? { ...item, playing: !item.playing } : item))}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="empty-grid relative flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-stone-300 bg-paper px-6 py-12 text-center">
                                <div className="empty-orbit absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-forest-200" />
                                <div className="empty-orbit empty-orbit-delayed absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-stone-200" />
                                <div className="relative mb-4 flex size-14 items-center justify-center rounded-2xl border border-forest-200 bg-forest-50 text-forest-600 shadow-sm">
                                    <CameraIcon className="size-6" />
                                </div>
                                <h3 className="relative text-base font-semibold text-stone-800">Your view starts here</h3>
                                <p className="relative mt-2 max-w-sm text-sm leading-6 text-stone-500">
                                    Add your first camera above. Your stream tiles will gather here in a responsive grid.
                                </p>
                                <a className="relative mt-5 inline-flex items-center gap-2 text-sm font-semibold text-forest-700 transition hover:text-forest-900" href="#stream-url">
                                    Add your first camera
                                    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
                                        <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </a>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}

export default App;
