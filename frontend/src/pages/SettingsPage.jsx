import { LuRotateCcw } from "react-icons/lu";
import PageHeading from "../components/PageHeading.jsx";

const layouts = [
    ["1x1", "1 × 1"],
    ["2x2", "2 × 2"],
    ["3x3", "3 × 3"],
    ["4x4", "4 × 4"],
];

function PreferenceRow({ checked, detail, label, onChange }) {
    return (
        <label className="flex cursor-pointer items-center justify-between gap-5 border-b border-stone-100 py-4 last:border-b-0">
            <span>
                <span className="block text-sm font-medium text-stone-700">{label}</span>
                <span className="mt-1 block max-w-2xl text-xs leading-5 text-stone-500">{detail}</span>
            </span>
            <input
                checked={checked}
                className="size-5 shrink-0 cursor-pointer accent-[var(--color-forest-700)]"
                onChange={(event) => onChange(event.target.checked)}
                type="checkbox"
            />
        </label>
    );
}

export default function SettingsPage({
    autoStartCameras,
    layout,
    onAutoStartCamerasChange,
    onLayoutChange,
    onPauseCamerasOutsideLiveChange,
    pauseCamerasOutsideLive,
}) {
    function resetPreferences() {
        onLayoutChange("2x2");
        onAutoStartCamerasChange(true);
        onPauseCamerasOutsideLiveChange(true);
    }

    return (
        <div className="flex flex-col gap-5">
            <PageHeading
                action={(
                    <button
                        className="inline-flex min-h-9 items-center gap-2 self-start rounded-lg border border-stone-200 bg-[var(--color-surface)] px-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 sm:self-auto"
                        onClick={resetPreferences}
                        type="button"
                    >
                        <LuRotateCcw aria-hidden="true" className="size-4" />
                        Reset to defaults
                    </button>
                )}
                description="Control how your RTSP camera feeds behave in this browser."
                title="Settings"
            />

            <section
                aria-labelledby="camera-playback-heading"
                className="rounded-xl border border-stone-200 bg-[var(--color-surface)] p-4 sm:p-5"
            >
                <div className="border-b border-stone-100 pb-3">
                    <h3 className="text-base font-semibold text-stone-800" id="camera-playback-heading">Camera playback</h3>
                    <p className="mt-1 text-xs leading-5 text-stone-500">
                        These preferences are saved on this device and affect real camera connections.
                    </p>
                </div>

                <div className="flex flex-col">
                    <div className="flex flex-col gap-3 border-b border-stone-100 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                        <div>
                            <label className="block text-sm font-medium text-stone-700" htmlFor="default-camera-layout">
                                Default camera layout
                            </label>
                            <p className="mt-1 text-xs leading-5 text-stone-500">
                                Choose the grid used when you open the Live dashboard.
                            </p>
                        </div>
                        <select
                            className="min-h-10 min-w-36 self-start rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 outline-none transition focus:border-[var(--color-forest-700)] focus:ring-2 focus:ring-[var(--color-forest-700)]/15 sm:self-auto"
                            id="default-camera-layout"
                            onChange={(event) => onLayoutChange(event.target.value)}
                            value={layout}
                        >
                            {layouts.map(([value, label]) => (
                                <option key={value} value={value}>{label} ({Number(value[0]) ** 2} cameras)</option>
                            ))}
                        </select>
                    </div>

                    <PreferenceRow
                        checked={autoStartCameras}
                        detail="Connect saved cameras automatically when you open Live. Turn this off to open the dashboard with cameras paused."
                        label="Start cameras automatically"
                        onChange={onAutoStartCamerasChange}
                    />
                    <PreferenceRow
                        checked={pauseCamerasOutsideLive}
                        detail="Pause camera feeds when you leave Live to release backend stream slots and reduce unnecessary network use."
                        label="Pause feeds outside Live"
                        onChange={onPauseCamerasOutsideLiveChange}
                    />
                </div>

                <p className="mt-3 rounded-lg bg-[var(--color-canvas-soft)] px-3 py-2 text-xs leading-5 text-stone-500">
                    Changes are saved automatically in this browser.
                </p>
            </section>
        </div>
    );
}
