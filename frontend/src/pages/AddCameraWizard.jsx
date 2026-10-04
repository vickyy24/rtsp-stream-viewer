import { useEffect, useRef, useState } from "react";
import { LuCheck, LuChevronLeft, LuChevronRight, LuCircleCheck, LuCircleDot } from "react-icons/lu";
import PageHeading from "../components/PageHeading.jsx";
import { testStreamConnection } from "../services/streamService.js";

const steps = ["Camera details", "Test connection", "Preview", "Save"];

function StepIndicator({ currentStep }) {
    return (
        <ol className="grid grid-cols-2 gap-3 border-b border-stone-200 pb-4 sm:grid-cols-4">
            {steps.map((label, index) => {
                const step = index + 1;
                const complete = step < currentStep;
                const active = step === currentStep;
                return (
                    <li className="flex items-center gap-2" key={label}>
                        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${complete || active
                            ? "brand-gradient text-white"
                            : "bg-stone-100 text-stone-500"
                            }`}>
                            {complete ? <LuCheck aria-hidden="true" className="size-3.5" /> : step}
                        </span>
                        <span className={`truncate text-xs font-medium ${active ? "text-stone-800" : "text-stone-500"}`}>
                            {label}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

export default function AddCameraWizard({ onCancel, onSave }) {
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [locationName, setLocationName] = useState("");
    const [url, setUrl] = useState("");
    const [testState, setTestState] = useState("idle");
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [testSession, setTestSession] = useState(null);
    const testSessionRef = useRef(null);
    const handedOffRef = useRef(false);

    useEffect(() => () => {
        if (!handedOffRef.current) testSessionRef.current?.stop();
    }, []);

    function clearTestSession() {
        testSessionRef.current?.stop();
        testSessionRef.current = null;
        setTestSession(null);
        setTestState("idle");
    }

    async function handleTest() {
        clearTestSession();
        setTestState("testing");
        setError("");
        try {
            const session = await testStreamConnection({ url: url.trim() });
            testSessionRef.current = session;
            setTestSession(session);
            setTestState("success");
        } catch (testError) {
            setTestState("error");
            setError(testError.message);
        }
    }

    function continueWizard() {
        if (step === 1) {
            const nextFieldErrors = {};
            const trimmedName = name.trim();
            const trimmedLocation = locationName.trim();
            const trimmedUrl = url.trim();
            if (!trimmedName) nextFieldErrors.name = "Enter a camera name.";
            else if (trimmedName.length > 120) nextFieldErrors.name = "Use 120 characters or fewer.";
            if (!trimmedLocation) nextFieldErrors.location = "Enter a camera location.";
            else if (trimmedLocation.length > 160) nextFieldErrors.location = "Use 160 characters or fewer.";
            if (!trimmedUrl) {
                nextFieldErrors.url = "Enter an RTSP or RTSPS address.";
            } else if (trimmedUrl.length > 2048) {
                nextFieldErrors.url = "The address must be 2,048 characters or fewer.";
            }
            try {
                if (trimmedUrl) {
                    const parsedUrl = new URL(trimmedUrl);
                    if (!["rtsp:", "rtsps:"].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
                        nextFieldErrors.url = "Enter a complete RTSP or RTSPS address.";
                    }
                }
            } catch {
                if (trimmedUrl) nextFieldErrors.url = "Enter a complete RTSP or RTSPS address.";
            }
            setFieldErrors(nextFieldErrors);
            if (Object.keys(nextFieldErrors).length) {
                setError("");
                return;
            }
            setError("");
            setStep(2);
            return;
        }
        if (step === 2 && testState !== "success") return;
        setStep((current) => Math.min(4, current + 1));
    }

    function goBack() {
        if (step === 2) {
            clearTestSession();
            setError("");
        }
        setStep((current) => Math.max(1, current - 1));
    }

    async function saveCamera() {
        if (!testSession?.isOpen()) {
            setError("The tested stream disconnected. Test it again before saving.");
            clearTestSession();
            setStep(2);
            return;
        }
        setSaving(true);
        setError("");
        try {
            const savedCamera = await onSave({
                location: locationName.trim(),
                name: name.trim(),
                url: url.trim(),
            });
            testSession.stop();
            testSessionRef.current = null;
            handedOffRef.current = true;
            return savedCamera;
        } catch (saveError) {
            setError(saveError.message || "Camera could not be saved. Try again.");
            setSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-5">
            <PageHeading
                description="Add a stream source to this browser workspace."
                title="Add camera"
            />
            <section className="rounded-xl border border-stone-200 bg-[var(--color-surface)] p-4 sm:p-5">
                <StepIndicator currentStep={step} />

                {step === 1 && (
                    <div className="grid gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
                        <div className="flex flex-col gap-4">
                            <h2 className="text-base font-semibold text-stone-800">Camera details</h2>
                            <label className="flex flex-col gap-1.5 text-xs font-medium text-stone-600" htmlFor="camera-name">
                                Camera name
                                <input
                                    aria-invalid={Boolean(fieldErrors.name)}
                                    aria-describedby={fieldErrors.name ? "camera-name-error" : undefined}
                                    className={`rounded-lg border bg-[var(--color-canvas-soft)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-olive-600)] ${fieldErrors.name ? "border-rose-500" : "border-stone-200"}`}
                                    id="camera-name"
                                    maxLength={120}
                                    onChange={(event) => {
                                        setName(event.target.value);
                                        setFieldErrors((current) => ({ ...current, name: "" }));
                                    }}
                                    placeholder="e.g. Main entrance"
                                    required
                                    value={name}
                                />
                                {fieldErrors.name && <span className="text-xs font-normal text-rose-700" id="camera-name-error">{fieldErrors.name}</span>}
                            </label>
                            <label className="flex flex-col gap-1.5 text-xs font-medium text-stone-600" htmlFor="camera-location">
                                <span>Camera location <span aria-hidden="true" className="text-rose-700">*</span></span>
                                <input
                                    aria-invalid={Boolean(fieldErrors.location)}
                                    aria-describedby={fieldErrors.location ? "camera-location-error" : undefined}
                                    className={`rounded-lg border bg-[var(--color-canvas-soft)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-olive-600)] ${fieldErrors.location ? "border-rose-500" : "border-stone-200"}`}
                                    id="camera-location"
                                    maxLength={160}
                                    onChange={(event) => {
                                        setLocationName(event.target.value);
                                        setFieldErrors((current) => ({ ...current, location: "" }));
                                    }}
                                    placeholder="e.g. Office, parking lot"
                                    required
                                    value={locationName}
                                />
                                {fieldErrors.location && <span className="text-xs font-normal text-rose-700" id="camera-location-error">{fieldErrors.location}</span>}
                            </label>
                            <label className="flex flex-col gap-1.5 text-xs font-medium text-stone-600" htmlFor="camera-url">
                                RTSP address
                                <input
                                    aria-invalid={Boolean(fieldErrors.url)}
                                    aria-describedby={fieldErrors.url ? "camera-url-error" : undefined}
                                    autoComplete="off"
                                    className={`rounded-lg border bg-[var(--color-canvas-soft)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-olive-600)] ${fieldErrors.url ? "border-rose-500" : "border-stone-200"}`}
                                    id="camera-url"
                                    inputMode="url"
                                    maxLength={2048}
                                    onChange={(event) => {
                                        setUrl(event.target.value);
                                        setFieldErrors((current) => ({ ...current, url: "" }));
                                        clearTestSession();
                                    }}
                                    placeholder="rtsp://camera-address:554/stream"
                                    required
                                    type="text"
                                    value={url}
                                />
                                {fieldErrors.url && <span className="text-xs font-normal text-rose-700" id="camera-url-error">{fieldErrors.url}</span>}
                            </label>
                        </div>
                        <aside className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                            <h3 className="text-sm font-semibold text-stone-700">Connection status</h3>
                            <ol className="mt-4 flex flex-col gap-4">
                                {["Waiting for connection", "Resolving stream", "Establishing connection", "Receiving video"].map((label, index) => (
                                    <li className="flex items-center gap-2.5 text-xs text-stone-500" key={label}>
                                        {index === 0
                                            ? <LuCircleDot className="size-4 text-[var(--color-clay-500)]" />
                                            : <span className="size-4 rounded-full border border-stone-300 bg-white" />}
                                        {label}
                                    </li>
                                ))}
                            </ol>
                        </aside>
                    </div>
                )}

                {step === 2 && (
                    <div className="flex min-h-64 flex-col items-center justify-center py-8 text-center">
                        {testState === "success"
                            ? <LuCircleCheck aria-hidden="true" className="size-10 text-[var(--color-olive-600)]" />
                            : testState === "testing"
                                ? <LuCircleDot aria-hidden="true" className="size-10 text-[var(--color-forest-700)]" />
                                : <LuCircleDot aria-hidden="true" className="size-10 text-stone-400" />}
                        <h2 className="mt-3 text-base font-semibold text-stone-800">
                            {testState === "success" ? "Connection test passed" : testState === "testing" ? "Testing stream connection…" : "Test the camera connection"}
                        </h2>
                        <p className="mt-1 max-w-md text-xs leading-5 text-stone-500">
                            The backend will open the RTSP source and wait for a video frame before confirming the test.
                        </p>
                        {error && <p className="mt-3 text-xs text-rose-600" role="alert">{error}</p>}
                        {testState !== "success" && (
                            <button
                                className="brand-gradient mt-4 inline-flex min-h-10 items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-700)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-stone-500 disabled:shadow-none"
                                disabled={testState === "testing"}
                                onClick={handleTest}
                                type="button"
                            >
                                {testState === "testing" ? "Testing…" : "Test connection"}
                            </button>
                        )}
                    </div>
                )}

                {step === 3 && (
                    <div className="grid min-h-64 gap-4 py-5 md:grid-cols-[minmax(0,1fr)_16rem]">
                        <div className="flex aspect-video flex-col items-center justify-center rounded-lg border border-stone-200 bg-stone-100 text-center">
                            <LuCircleCheck aria-hidden="true" className="size-8 text-[var(--color-olive-600)]" />
                            <h2 className="mt-3 text-base font-semibold text-stone-800">Source is reachable</h2>
                            <p className="mt-1 text-xs text-stone-500">A live preview starts after saving this camera.</p>
                        </div>
                        <aside className="rounded-lg border border-stone-200 p-4">
                            <h3 className="text-sm font-semibold text-stone-700">Camera preview</h3>
                            <dl className="mt-3 flex flex-col gap-2 text-xs">
                                <div><dt className="text-stone-400">Name</dt><dd className="mt-0.5 text-stone-700">{name}</dd></div>
                                <div><dt className="text-stone-400">Location</dt><dd className="mt-0.5 text-stone-700">{locationName || "Not set"}</dd></div>
                            </dl>
                        </aside>
                    </div>
                )}

                {step === 4 && (
                    <div className="flex min-h-64 flex-col justify-center py-6">
                        <h2 className="text-base font-semibold text-stone-800">Review and save</h2>
                        <p className="mt-1 text-xs text-stone-500">The camera connection is stored securely by the stream service so it can reconnect after refresh.</p>
                        <dl className="mt-5 grid gap-4 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2">
                            <div><dt className="text-xs text-stone-400">Camera name</dt><dd className="mt-1 text-sm font-medium text-stone-700">{name}</dd></div>
                            <div><dt className="text-xs text-stone-400">Location</dt><dd className="mt-1 text-sm font-medium text-stone-700">{locationName || "Not set"}</dd></div>
                        </dl>
                    </div>
                )}

                {error && step === 1 && <p className="pb-3 text-xs text-rose-600" role="alert">{error}</p>}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
                    <button
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-stone-300 bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition-colors hover:border-stone-400 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-700)] focus-visible:ring-offset-2"
                        onClick={step === 1 ? onCancel : goBack}
                        type="button"
                    >
                        {step === 1 ? "Cancel" : <><LuChevronLeft className="size-4" /> Back</>}
                    </button>
                    {step < 4 ? (
                        <button
                            className="brand-gradient inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-700)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-stone-500"
                            disabled={step === 2 && testState !== "success"}
                            onClick={continueWizard}
                            type="button"
                        >
                            Continue <LuChevronRight aria-hidden="true" className="size-4" />
                        </button>
                    ) : (
                        <button
                            className="brand-gradient rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-wait disabled:opacity-70"
                            disabled={saving}
                            onClick={saveCamera}
                            type="button"
                        >
                            {saving ? "Saving…" : "Save camera"}
                        </button>
                    )}
                </div>
            </section>
        </div>
    );
}
