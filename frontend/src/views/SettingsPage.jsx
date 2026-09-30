import { LuSettings, LuShieldCheck, LuVideo } from "react-icons/lu";
import PageHeading from "../components/PageHeading.jsx";

function SettingRow({ label, value, detail }) {
    return (
        <div className="flex flex-col gap-1 border-b border-stone-100 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
            <div>
                <p className="text-sm font-medium text-stone-700">{label}</p>
                <p className="mt-0.5 text-xs text-stone-400">{detail}</p>
            </div>
            <p className="break-all text-xs font-medium text-stone-600">{value}</p>
        </div>
    );
}

export default function SettingsPage() {
    const endpoint = import.meta.env.VITE_STREAM_WS_URL || "Local default (port 8000)";

    return (
        <div className="flex flex-col gap-5">
            <PageHeading
                description="Workspace and stream service configuration."
                title="Settings"
            />
            <div className="grid gap-4 xl:grid-cols-[13rem_minmax(0,1fr)]">
                <nav aria-label="Settings categories" className="flex gap-2 overflow-x-auto xl:flex-col">
                    {[
                        ["General", "#general-settings", LuSettings],
                        ["Stream", "#stream-settings", LuVideo],
                        ["Access", "#access-settings", LuShieldCheck],
                    ].map(([label, target, Icon], index) => (
                        <a
                            aria-current={index === 0 ? "location" : undefined}
                            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium ${index === 0
                                ? "bg-[var(--color-forest-100)] text-[var(--color-forest-800)]"
                                : "text-stone-500 hover:bg-stone-100"
                                }`}
                            href={target}
                            key={label}
                        >
                            <Icon aria-hidden="true" className="size-4" />
                            {label}
                        </a>
                    ))}
                </nav>
                <div className="flex flex-col gap-4">
                    <section className="scroll-mt-4 rounded-xl border border-stone-200 bg-[var(--color-surface)] p-4" id="general-settings">
                        <h2 className="text-sm font-semibold text-stone-800">General</h2>
                        <div className="mt-2">
                            <SettingRow
                                detail="Product name shown in this workspace"
                                label="Application"
                                value="Signal · RTSP Stream Viewer"
                            />
                        </div>
                    </section>
                    <section className="scroll-mt-4 rounded-xl border border-stone-200 bg-[var(--color-surface)] p-4" id="stream-settings">
                        <h2 className="text-sm font-semibold text-stone-800">Stream</h2>
                        <div className="mt-2">
                            <SettingRow
                                detail="WebSocket endpoint used by camera players"
                                label="Stream service"
                                value={endpoint}
                            />
                            <SettingRow
                                detail="Maximum active streams, configured on the backend"
                                label="Per-process stream limit"
                                value="4"
                            />
                        </div>
                    </section>
                    <section className="scroll-mt-4 rounded-xl border border-stone-200 bg-[var(--color-surface)] p-4" id="access-settings">
                        <h2 className="text-sm font-semibold text-stone-800">Access and unavailable features</h2>
                        <p className="mt-2 text-xs leading-5 text-stone-500">
                            Stream access uses one workspace key from the backend environment; there are no individual user accounts. Recording, notifications, and saved workspace preferences are not implemented. This screen reports service configuration and does not offer settings the backend cannot store.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
