import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import SignalLogo from "../components/SignalLogo.jsx";
import { signInAccount, signUpAccount, verifyAccountEmail } from "../services/streamService.js";

function AuthInput({ autoComplete, error, id, inputMode, label, maxLength, onChange, type = "text", value }) {
    return (
        <div className="flex flex-col gap-1.5 text-sm font-medium text-stone-700">
            <label htmlFor={id}>{label}</label>
            <input
                aria-describedby={error ? `${id}-error` : undefined}
                aria-invalid={Boolean(error)}
                autoComplete={autoComplete}
                className={`auth-input h-11 rounded-lg border bg-white px-3 text-sm font-normal text-stone-900 outline-none transition focus:ring-2 focus:ring-[var(--color-forest-100)] ${error ? "border-rose-500 focus:border-rose-600" : "border-stone-200 focus:border-[var(--color-forest-700)]"}`}
                id={id}
                inputMode={inputMode}
                maxLength={maxLength}
                onChange={(event) => onChange(event.target.value)}
                required
                type={type}
                value={value}
            />
            {error && <p className="text-xs font-normal text-rose-700" id={`${id}-error`}>{error}</p>}
        </div>
    );
}

export default function AuthPage({ onLogin }) {
    const location = useLocation();
    const navigate = useNavigate();
    const mode = location.pathname === "/signup" ? "signup" : location.pathname === "/verify-email" ? "verify" : "signin";
    const verificationEmail = new URLSearchParams(location.search).get("email")?.trim().toLowerCase() || "";
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});

    function updateField(field, setter, value) {
        setter(value);
        setFieldErrors((current) => ({ ...current, [field]: "" }));
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        setFieldErrors({});
        try {
            const nextFieldErrors = {};
            if (mode === "verify") {
                if (!verificationEmail) {
                    setError("The signup email is missing. Return to sign up and request a new code.");
                    return;
                }
                if (!/^\d{6}$/.test(verificationCode)) {
                    nextFieldErrors.code = "Enter the six-digit code sent to your email.";
                    setFieldErrors(nextFieldErrors);
                    return;
                }
                const user = await verifyAccountEmail(verificationEmail, verificationCode);
                onLogin(user);
                navigate("/live", { replace: true });
                return;
            }

            const emailInput = event.currentTarget.elements.email;
            if (!email.trim()) nextFieldErrors.email = "Enter your email address.";
            else if (emailInput.validity.typeMismatch) nextFieldErrors.email = "Enter a valid email address.";
            if (!password) nextFieldErrors.password = "Enter your password.";

            if (mode === "signup") {
                if (!fullName.trim()) nextFieldErrors.fullName = "Enter your full name.";
                if (fullName.trim().length > 150) nextFieldErrors.fullName = "Use 150 characters or fewer.";
                if (password.length < 10) nextFieldErrors.password = "Use at least 10 characters.";
                if (password.length > 128) nextFieldErrors.password = "Use 128 characters or fewer.";
                if (!confirmation) nextFieldErrors.confirmation = "Confirm your password.";
                else if (password !== confirmation) nextFieldErrors.confirmation = "Passwords do not match.";
            }
            if (Object.keys(nextFieldErrors).length) {
                setFieldErrors(nextFieldErrors);
                return;
            }

            if (mode === "signup") {
                await signUpAccount({
                    full_name: fullName.trim(),
                    email: email.trim(),
                    password,
                });
                navigate(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`, { replace: true });
            } else {
                const user = await signInAccount({ email: email.trim(), password });
                onLogin(user);
                navigate("/live", { replace: true });
            }
        } catch (requestError) {
            setError(requestError.message || "Something went wrong. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    const isSignup = mode === "signup";
    const isVerify = mode === "verify";

    return (
        <main className="flex min-h-dvh items-center justify-center bg-[var(--color-app-background)] px-4 py-10">
            <section className="w-full max-w-md rounded-2xl border border-stone-200 bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">
                <div className="mb-7 flex items-center gap-3">
                    <SignalLogo className="size-11 shrink-0" />
                    <div>
                        <p className="text-sm font-bold tracking-[0.24em] text-stone-900">SIGNAL</p>
                        <p className="text-xs text-stone-500">RTSP STREAM VIEWER</p>
                    </div>
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                    {isVerify ? "Verify your email" : isSignup ? "Create your account" : "Welcome back"}
                </h1>
                <p className="mt-1.5 text-sm leading-6 text-stone-500">
                    {isVerify
                        ? "Your account will be created after your email code is confirmed."
                        : isSignup
                            ? "Sign up with your name and email to manage your cameras."
                            : "Sign in to access your cameras and live streams."}
                </p>

                {isVerify ? (
                    <form className="mt-6 flex flex-col gap-4" noValidate onSubmit={submit}>
                        <p className="text-sm leading-6 text-stone-600">
                            Enter the six-digit code sent to <span className="font-medium text-stone-800">{verificationEmail || "your email"}</span>. The code expires in 10 minutes.
                        </p>
                        <AuthInput
                            autoComplete="one-time-code"
                            error={fieldErrors.code}
                            id="verification-code"
                            inputMode="numeric"
                            label="Email verification code"
                            maxLength={6}
                            onChange={(value) => updateField("code", setVerificationCode, value.replace(/\D/g, "").slice(0, 6))}
                            type="text"
                            value={verificationCode}
                        />
                        {error && <p aria-live="polite" className="text-sm text-rose-700" role="alert">{error}</p>}
                        <button className="brand-gradient mt-1 h-11 rounded-lg text-sm font-semibold disabled:cursor-wait disabled:opacity-60" disabled={busy} type="submit">
                            {busy ? "Verifying…" : "Verify email and continue"}
                        </button>
                        <Link className="text-center text-sm font-semibold text-[var(--color-forest-800)] hover:underline" to="/signup">
                            Back to sign up to request a new code
                        </Link>
                    </form>
                ) : (
                    <form className="mt-6 flex flex-col gap-4" noValidate onSubmit={submit}>
                        {isSignup && (
                            <AuthInput autoComplete="name" error={fieldErrors.fullName} id="full-name" label="Full name" maxLength={150} onChange={(value) => updateField("fullName", setFullName, value)} value={fullName} />
                        )}
                        <AuthInput autoComplete="off" error={fieldErrors.email} id="email" label="Email address" maxLength={254} onChange={(value) => updateField("email", setEmail, value)} type="email" value={email} />
                        <AuthInput autoComplete={isSignup ? "new-password" : "current-password"} error={fieldErrors.password} id="password" label="Password" maxLength={128} onChange={(value) => updateField("password", setPassword, value)} type="password" value={password} />
                        {isSignup && (
                            <AuthInput autoComplete="new-password" error={fieldErrors.confirmation} id="confirm-password" label="Confirm password" maxLength={128} onChange={(value) => updateField("confirmation", setConfirmation, value)} type="password" value={confirmation} />
                        )}
                        {error && <p aria-live="polite" className="text-sm text-rose-700">{error}</p>}
                        <button className="brand-gradient mt-1 h-11 rounded-lg text-sm font-semibold disabled:cursor-wait disabled:opacity-60" disabled={busy} type="submit">
                            {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
                        </button>
                    </form>
                )}

                {!isVerify && (
                    <p className="mt-6 text-center text-sm text-stone-500">
                        {isSignup ? "Already have an account? " : "New to Signal? "}
                        <Link className="font-semibold text-[var(--color-forest-800)] hover:underline" to={isSignup ? "/signin" : "/signup"}>
                            {isSignup ? "Sign in" : "Create an account"}
                        </Link>
                    </p>
                )}
            </section>
        </main>
    );
}
