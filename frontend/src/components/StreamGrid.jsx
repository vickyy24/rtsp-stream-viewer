import StreamCard from "./StreamCard.jsx";

export default function StreamGrid({
    layout,
    onRemove,
    onRetry,
    onStatusChange,
    onToggle,
    streams,
}) {
    const gridClass = {
        "1x1": "grid-cols-1",
        "2x2": "grid-cols-1 md:grid-cols-2",
        "3x3": "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
        "4x4": "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
    }[layout] || "grid-cols-1 md:grid-cols-2";

    if (!streams.length) return null;

    return (
        <div className={`grid gap-3 ${gridClass}`}>
            {streams.map((stream, index) => (
                <StreamCard
                    index={index}
                    key={stream.id}
                    stream={stream}
                    onRemove={() => onRemove(stream.id)}
                    onStatusChange={onStatusChange}
                    onRetry={() => onRetry(stream.id)}
                    onToggle={() => onToggle(stream.id)}
                />
            ))}
        </div>
    );
}
