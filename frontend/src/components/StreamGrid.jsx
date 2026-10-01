import StreamCard from "./StreamCard.jsx";

export default function StreamGrid({
    layout,
    isFullscreen,
    onRemove,
    onRetry,
    onFrame,
    onSelect,
    onStatusChange,
    onToggle,
    selectedId,
    streams,
}) {
    const gridClass = {
        "1x1": "grid-cols-1",
        "2x2": "grid-cols-1 md:grid-cols-2",
        "3x3": "grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3",
        "4x4": "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
    }[layout] || "grid-cols-1 md:grid-cols-2";

    if (!streams.length) return null;

    const fullscreenRows = {
        "1x1": "grid-rows-1",
        "2x2": "grid-rows-2",
        "3x3": "grid-rows-2 2xl:grid-rows-3",
        "4x4": "grid-rows-2 xl:grid-rows-3 2xl:grid-rows-4",
    }[layout] || "grid-rows-2";

    return (
        <div className={`${isFullscreen ? `grid min-h-0 flex-1 gap-3 ${fullscreenRows}` : "grid gap-3"} ${gridClass}`}>
            {streams.map((stream, index) => (
                <StreamCard
                    index={index}
                    key={stream.id}
                    stream={stream}
                    isFullscreen={isFullscreen}
                    isSelected={selectedId === stream.id}
                    onFrame={onFrame}
                    onRemove={() => onRemove(stream.id)}
                    onSelect={() => onSelect(stream.id)}
                    onStatusChange={onStatusChange}
                    onRetry={() => onRetry(stream.id)}
                    onToggle={() => onToggle(stream.id)}
                />
            ))}
        </div>
    );
}
