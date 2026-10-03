import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import SignalLogo from "../components/SignalLogo.jsx";
import { signInAccount, signUpAccount, verifyAccountEmail } from "../services/streamService.js";

function AuthInput({ autoComplete, error, id, label, maxLength, onChange, type = "text", value }) {
    return (
        <div className="flex flex-col gap-1.5 text-sm font-medium text-stone-700">
            <label htmlFor={id}>{label}</label>
            <input
                aria-describedby={error ? `${id}-error` : undefined}
                aria-invalid={Boolean(error)}
                autoComplete={autoComplete}
                className={`h-11 rounded-lg border bg-white px-3 text-sm text-stone-900 outline-none transition focus:ring-2 focus:ring-[var(--color-forest-100)] ${error ? "border-rose-500 focus:border-rose-600" : "border-stone-200 focus:border-[var(--color-forest-700)]"}`}
                id={id}
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
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [busy, setBusy] = useState(mode === "verify");
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [notice, setNotice] = useState("");

    function updateField(field, setter, value) {
        setter(value);
        setFieldErrors((current) => ({ ...current, [field]: "" }));
    }

    useEffect(() => {
        if (mode !== "verify") return;
        setBusy(true);
        setError("");
        setNotice("");
        const token = new URLSearchParams(location.search).get("token");
        if (!token) {
            setError("This verification link is missing its token.");
            setBusy(false);
            return;
        }
        let active = true;
        verifyAccountEmail(token)
            .then((result) => {
                if (active) setNotice(result.message);
            })
            .catch((verifyError) => {
                if (active) setError(verifyError.message);
            })
            .finally(() => {
                if (active) setBusy(false);
            });
        return () => { active = false; };
    }, [location.search, mode]);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        setFieldErrors({});
        try {
            if (mode === "signup") {
                const nextFieldErrors = {};
                if (!fullName.trim()) nextFieldErrors.fullName = "Enter your full name.";
                if (fullName.trim().length > 150) nextFieldErrors.fullName = "Use 150 characters or fewer.";
                if (password.length < 10) nextFieldErrors.password = "Use at least 10 characters.";
                if (password.length > 128) nextFieldErrors.password = "Use 128 characters or fewer.";
                if (password !== confirmation) nextFieldErrors.confirmation = "Passwords do not match.";
                if (Object.keys(nextFieldErrors).length) {
                    setFieldErrors(nextFieldErrors);
                    return;
                }
                const result = await signUpAccount({
                    full_name: fullName.trim(),
                    email: email.trim(),
                    password,
                });
                setNotice(result.message);
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
                        ? "We’re confirming your email address."
                        : isSignup
                            ? "Sign up with your name and email to manage your cameras."
                            : "Sign in to access your cameras and live streams."}
                </p>

                {isVerify ? (
                    <div aria-live="polite" className="mt-6">
                        {busy && <p className="text-sm text-stone-600">Verifying your email…</p>}
                        {error && <p className="text-sm text-rose-700">{error}</p>}
                        {notice && <p className="text-sm text-[var(--color-forest-800)]">{notice}</p>}
                        {!busy && (notice || error) && (
                            <Link className="brand-gradient mt-5 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold" to="/signin">
                                Continue to sign in
                            </Link>
                        )}
                    </div>
                ) : (
                    <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
                        {isSignup && (
                            <AuthInput autoComplete="name" error={fieldErrors.fullName} id="full-name" label="Full name" maxLength={150} onChange={(value) => updateField("fullName", setFullName, value)} value={fullName} />
                        )}
                        <AuthInput autoComplete="email" error={fieldErrors.email} id="email" label="Email address" maxLength={254} onChange={(value) => updateField("email", setEmail, value)} type="email" value={email} />
                        <AuthInput autoComplete={isSignup ? "new-password" : "current-password"} error={fieldErrors.password} id="password" label="Password" maxLength={128} onChange={(value) => updateField("password", setPassword, value)} type="password" value={password} />
                        {isSignup && (
                            <AuthInput autoComplete="new-password" error={fieldErrors.confirmation} id="confirm-password" label="Confirm password" maxLength={128} onChange={(value) => updateField("confirmation", setConfirmation, value)} type="password" value={confirmation} />
                        )}
                        {error && <p aria-live="polite" className="text-sm text-rose-700">{error}</p>}
                        {notice && (
                            <div aria-live="polite" className="rounded-lg border border-[var(--color-forest-200)] bg-[var(--color-forest-50)] p-3 text-sm leading-5 text-[var(--color-forest-900)]">
                                {notice} {isSignup && "Open the link in that email to verify your account."}
                            </div>
                        )}
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
