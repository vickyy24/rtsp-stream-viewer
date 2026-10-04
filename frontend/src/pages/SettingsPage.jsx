import { useState } from "react";
import { LuCheck, LuLoaderCircle, LuSettings, LuShieldCheck, LuVideo } from "react-icons/lu";
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

function PreferenceRow({ children, detail, label }) {
    return (
        <div className="flex flex-col gap-3 border-b border-stone-100 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
            <div>
                <p className="text-sm font-medium text-stone-700">{label}</p>
                <p className="mt-0.5 text-xs leading-5 text-stone-400">{detail}</p>
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

const layouts = [
    ["1x1", "1 × 1"],
    ["2x2", "2 × 2"],
    ["3x3", "3 × 3"],
    ["4x4", "4 × 4"],
];

export default function SettingsPage({ endpoint, layout, onLayoutChange, onTestStreamService, user }) {
    const [activeSection, setActiveSection] = useState("general-settings");
    const [connectionState, setConnectionState] = useState("idle");
    const [connectionMessage, setConnectionMessage] = useState("");

    async function testConnection() {
        setConnectionState("testing");
        setConnectionMessage("");
        try {
            await onTestStreamService();
            setConnectionState("connected");
            setConnectionMessage("Stream service is reachable and your account was authenticated.");
        } catch (error) {
            setConnectionState("error");
            setConnectionMessage(error.message || "Could not connect to the stream service.");
        }
    }

    return (
        <div className="flex flex-col gap-5">
            <PageHeading
                description="Workspace and stream service configuration."
                title="Settings"
            />
            <div className="grid gap-4 xl:grid-cols-[13rem_minmax(0,1fr)]">
                <nav aria-label="Settings categories" className="flex gap-2 overflow-x-auto xl:flex-col">
                    {[
                        ["General", "general-settings", LuSettings],
                        ["Stream", "stream-settings", LuVideo],
                        ["Access", "access-settings", LuShieldCheck],
                    ].map(([label, target, Icon]) => (
                        <button
                            aria-pressed={activeSection === target}
                            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${activeSection === target
                                ? "bg-[var(--color-forest-200)] text-[var(--color-forest-900)]"
                                : "text-stone-500 hover:bg-stone-100"
                                }`}
                            key={label}
                            onClick={() => {
                                setActiveSection(target);
                                document.getElementById(target)?.scrollIntoView({ block: "start", behavior: "smooth" });
                            }}
                            type="button"
                        >
                            <Icon aria-hidden="true" className="size-4" />
                            {label}
                        </button>
                    ))}
                </nav>
                <div className="flex flex-col gap-4">
                    <section className="scroll-mt-4 rounded-xl border border-stone-200 bg-[var(--color-surface)] p-4" id="general-settings">
                        <h2 className="text-base font-semibold text-stone-800">General</h2>
                        <div className="mt-2">
                            <SettingRow
                                detail="Product name shown in this workspace"
                                label="Application"
                                value="Signal · RTSP Stream Viewer"
                            />
                        </div>
                    </section>
                    <section className="scroll-mt-4 rounded-xl border border-stone-200 bg-[var(--color-surface)] p-4" id="stream-settings">
                        <h2 className="text-base font-semibold text-stone-800">Stream</h2>
                        <div className="mt-2">
                            <SettingRow
                                detail="WebSocket endpoint used by camera players"
                                label="Stream service"
                                value={endpoint}
                            />
                            <PreferenceRow
                                detail="Open the live dashboard with this camera grid arrangement. Saved in this browser."
                                label="Default dashboard layout"
                            >
                                <select
                                    aria-label="Default dashboard layout"
                                    className="min-h-10 min-w-36 rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 outline-none transition focus:border-[var(--color-forest-700)] focus:ring-2 focus:ring-[var(--color-forest-700)]/15"
                                    onChange={(event) => onLayoutChange(event.target.value)}
                                    value={layout}
                                >
                                    {layouts.map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </PreferenceRow>
                            <PreferenceRow
                                detail="Checks the WebSocket endpoint and verifies that your signed-in account can authenticate, without starting a camera feed."
                                label="Stream service connection"
                            >
                                <button
                                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-wait disabled:opacity-60"
                                    disabled={connectionState === "testing"}
                                    onClick={testConnection}
                                    type="button"
                                >
                                    {connectionState === "testing"
                                        ? <LuLoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                                        : connectionState === "connected"
                                            ? <LuCheck aria-hidden="true" className="size-4 text-emerald-700" />
                                            : null}
                                    {connectionState === "testing" ? "Testing…" : "Test connection"}
                                </button>
                            </PreferenceRow>
                            {connectionMessage && (
                                <p
                                    aria-live="polite"
                                    className={`mt-2 rounded-lg border px-3 py-2 text-xs leading-5 ${connectionState === "error"
                                        ? "border-rose-200 bg-rose-50 text-rose-800"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                        }`}
                                    role={connectionState === "error" ? "alert" : "status"}
                                >
                                    {connectionMessage}
                                </p>
                            )}
                            <p className="mt-3 text-xs leading-5 text-stone-500">
                                The connection test authenticates only; it does not open or consume a camera stream.
                            </p>
                        </div>
                    </section>
                    <section className="scroll-mt-4 rounded-xl border border-stone-200 bg-[var(--color-surface)] p-4" id="access-settings">
                        <h2 className="text-base font-semibold text-stone-800">Account access</h2>
                        <p className="mt-2 text-xs leading-5 text-stone-500">
                            Signed in as <span className="font-medium text-stone-700">{user?.email || "your account"}</span>. Password reset is available from the sign-in page; changing the account email is not currently supported here.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
