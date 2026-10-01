export default function SurfaceCard({ as: Element = "div", className = "", ...props }) {
    return (
        <Element
            className={`rounded-xl border border-stone-200 bg-[var(--color-surface)] p-4 ${className}`.trim()}
            {...props}
        />
    );
}
