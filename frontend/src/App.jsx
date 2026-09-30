import { useCallback, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import StreamGrid from "./components/StreamGrid.jsx";
import StreamInput from "./components/StreamInput.jsx";
import WorkspaceSummary from "./components/WorkspaceSummary.jsx";

function App() {
    const [streamUrl, setStreamUrl] = useState("");
    const [accessKey, setAccessKey] = useState("");
    const [streams, setStreams] = useState([]);
    const [error, setError] = useState("");
    const [statuses, setStatuses] = useState({});

    const updateStatus = useCallback((streamId, status) => {
        setStatuses((current) => current[streamId] === status
            ? current
            : { ...current, [streamId]: status });
    }, []);

    function handleSubmit(event) {
        event.preventDefault();
        setError("");

        const url = streamUrl.trim();
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
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
                url,
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
        setStreams((currentStreams) => currentStreams.filter((stream) => stream.id !== streamId));
    }

    function retryStream(streamId) {
        setStreams((current) => current.map((stream) => stream.id === streamId
            ? { ...stream, accessKey, retryCount: stream.retryCount + 1 }
            : stream));
    }

    function toggleStream(streamId) {
        setStreams((current) => current.map((stream) => stream.id === streamId
            ? { ...stream, playing: !stream.playing }
            : stream));
    }

    const liveCount = Object.values(statuses).filter((status) => status === "live").length;

    return (
        <div className="min-h-screen bg-[var(--color-app-background)] text-stone-900 lg:flex">
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
                        <div className="flex items-center gap-3 self-start rounded-full border border-stone-200 bg-[var(--color-surface)] px-3.5 py-2 sm:self-auto">
                            <span className="inline-flex size-2.5 rounded-full bg-[var(--color-olive-500)]" />
                            <span className="text-xs font-medium text-stone-600">Workspace online</span>
                        </div>
                    </header>

                    <WorkspaceSummary cameraCount={streams.length} liveCount={liveCount} />
                    <StreamInput
                        accessKey={accessKey}
                        error={error}
                        onAccessKeyChange={setAccessKey}
                        onSubmit={handleSubmit}
                        onUrlChange={setStreamUrl}
                        streamUrl={streamUrl}
                    />
                    <StreamGrid
                        onRemove={removeStream}
                        onRetry={retryStream}
                        onStatusChange={updateStatus}
                        onToggle={toggleStream}
                        streams={streams}
                    />
                </div>
            </main>
        </div>
    );
}

export default App;
