import StreamCard from "./StreamCard.jsx";

export default function StreamGrid({
    layout,
    isFullscreen,
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
        "2x2": "grid-cols-2",
        "3x3": "grid-cols-3",
        "4x4": "grid-cols-4",
    }[layout] || "grid-cols-2";

    if (!streams.length) return null;

    const fullscreenRows = {
        "1x1": "grid-rows-1",
        "2x2": "grid-rows-2",
        "3x3": "grid-rows-3",
        "4x4": "grid-rows-4",
    }[layout] || "grid-rows-2";

    return (
        <div className={`${isFullscreen ? `grid min-h-0 min-w-0 w-full flex-1 gap-3 ${fullscreenRows}` : "grid min-w-0 w-full gap-3"} ${gridClass}`}>
            {streams.map((stream, index) => (
                <StreamCard
                    index={index}
                    key={stream.id}
                    stream={stream}
                    isFullscreen={isFullscreen}
                    isSelected={selectedId === stream.id}
                    onFrame={onFrame}
                    onSelect={() => onSelect(stream.id)}
                    onStatusChange={onStatusChange}
                    onToggle={() => onToggle(stream.id)}
                    onRetry={() => onRetry(stream.id)}
                />
            ))}
        </div>
    );
}
