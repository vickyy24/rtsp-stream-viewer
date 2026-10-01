import { LuCheck, LuLayoutGrid } from "react-icons/lu";
import PageHeading from "../components/PageHeading.jsx";

const layouts = [
    { id: "1x1", label: "1 × 1", columns: 1, rows: 1 },
    { id: "2x2", label: "2 × 2", columns: 2, rows: 2 },
    { id: "3x3", label: "3 × 3", columns: 3, rows: 3 },
    { id: "4x4", label: "4 × 4", columns: 4, rows: 4 },
];

function LayoutPreview({ columns, rows, active }) {
    const slots = Math.min(columns * rows, 9);
    return (
        <div
            className="grid aspect-video w-full gap-1 rounded-lg border border-stone-200 bg-stone-50 p-2"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
            {Array.from({ length: slots }, (_, index) => (
                <span
                    className={`rounded-sm border ${active && index === 0
                        ? "border-[var(--color-forest-700)] bg-[var(--color-forest-200)]"
                        : "border-stone-200 bg-[var(--color-surface)]"
                        }`}
                    key={index}
                />
            ))}
        </div>
    );
}

export default function LayoutsPage({ layout, onApply }) {
    return (
        <div className="flex flex-col gap-5">
            <PageHeading
                description="Choose how camera tiles are arranged in the live dashboard."
                title="Layouts"
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {layouts.map((item) => (
                    <article
                        className={`rounded-xl border bg-[var(--color-surface)] p-3 ${layout === item.id
                            ? "border-[var(--color-forest-700)] ring-1 ring-[var(--color-forest-700)]"
                            : "border-stone-200"
                            }`}
                        key={item.id}
                    >
                        <LayoutPreview
                            active={layout === item.id}
                            columns={item.columns}
                            rows={item.rows}
                        />
                        <div className="mt-3 flex items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-semibold text-stone-800">{item.label}</h2>
                                <p className="mt-0.5 text-xs text-stone-500">{item.columns * item.rows} tile slots</p>
                            </div>
                            <button
                                aria-label={`Apply ${item.label} layout`}
                                className="flex size-8 items-center justify-center rounded-lg text-[var(--color-forest-700)] hover:bg-[var(--color-forest-50)]"
                                onClick={() => onApply(item.id)}
                                type="button"
                            >
                                {layout === item.id
                                    ? <LuCheck aria-hidden="true" className="size-4" />
                                    : <LuLayoutGrid aria-hidden="true" className="size-4" />}
                            </button>
                        </div>
                    </article>
                ))}
            </div>
            <p className="rounded-lg border border-stone-200 bg-[var(--color-surface)] p-3 text-xs leading-5 text-stone-500">
                Layout choice applies to this browser session. The server currently limits active feeds to four per process.
            </p>
        </div>
    );
}
