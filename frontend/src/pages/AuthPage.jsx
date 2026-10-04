import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { FiCamera, FiEye, FiEyeOff, FiGrid, FiKey, FiLock, FiMail, FiPlayCircle, FiRefreshCw, FiShield, FiUser } from "react-icons/fi";
import SignalLogo from "../components/SignalLogo.jsx";
import {
    requestPasswordReset,
    resendSignupVerification,
    resetAccountPassword,
    signInAccount,
    signUpAccount,
    verifyAccountEmail,
} from "../services/streamService.js";

function AuthInput({ autoComplete, error, id, inputMode, label, maxLength, onChange, placeholder, roomy = false, type = "text", value }) {
    const [showPassword, setShowPassword] = useState(false);
    const FieldIcon = type === "email" ? FiMail
        : id.includes("password") ? FiLock
            : id.includes("name") ? FiUser : FiKey;
    const isPassword = type === "password";
    return (
        <div className="auth-field">
            <label className={`auth-label [@media(max-height:760px)_and_(min-width:681px)]:!text-[12px] ${roomy ? "!text-[18px]" : ""}`} htmlFor={id}>{label}</label>
            <div className={`auth-control [@media(max-height:760px)_and_(min-width:681px)]:!h-[42px] ${roomy ? "!h-[clamp(54px,6.8vh,68px)]" : ""} ${error ? "has-error" : ""}`}>
                <FieldIcon aria-hidden="true" className="auth-control-icon" />
                <input
                    aria-describedby={error ? `${id}-error` : undefined}
                    aria-invalid={Boolean(error)}
                    autoComplete={autoComplete}
                    className={`auth-input [@media(max-height:760px)_and_(min-width:681px)]:!text-[14px] ${roomy ? "!text-[18px]" : ""}`}
                    id={id}
                    inputMode={inputMode}
                    maxLength={maxLength}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder || label}
                    required
                    type={isPassword && showPassword ? "text" : type}
                    value={value}
                />
                {isPassword && (
                    <button
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="auth-password-toggle"
                        onClick={() => setShowPassword((shown) => !shown)}
                        type="button"
                    >
                        {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                    </button>
                )}
            </div>
            {error && <p className="text-xs font-normal text-rose-700" id={`${id}-error`}>{error}</p>}
        </div>
    );
}

function FormAlert({ children }) {
    if (!children) return null;
    return (
        <div aria-live="polite" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm leading-5 text-rose-800" role="alert">
            {children}
        </div>
    );
}

export default function AuthPage({ onLogin }) {
    const location = useLocation();
    const navigate = useNavigate();
    const mode = location.pathname === "/signup" ? "signup"
        : location.pathname === "/verify-email" ? "verify"
            : location.pathname === "/forgot-password" ? "forgot"
                : location.pathname === "/reset-password" ? "reset" : "signin";
    const verificationEmail = new URLSearchParams(location.search).get("email")?.trim().toLowerCase() || "";
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState(verificationEmail);
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [confirmation, setConfirmation] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [resendSeconds, setResendSeconds] = useState(0);
    const [verificationNotice, setVerificationNotice] = useState("");
    const [busy, setBusy] = useState(false);
    const [googleBusy, setGoogleBusy] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});

    useEffect(() => {
        if (mode !== "verify") {
            setResendSeconds(0);
            return undefined;
        }
        setResendSeconds(30);
        const timer = window.setInterval(() => {
            setResendSeconds((remaining) => {
                if (remaining <= 1) {
                    window.clearInterval(timer);
                    return 0;
                }
                return remaining - 1;
            });
        }, 1000);
        return () => window.clearInterval(timer);
    }, [mode, verificationEmail]);

    function updateField(field, setter, value) {
        setter(value);
        setFieldErrors((current) => ({ ...current, [field]: "" }));
    }

    async function resendCode() {
        setBusy(true);
        setError("");
        setVerificationNotice("");
        try {
            await resendSignupVerification(verificationEmail);
            setVerificationCode("");
            setVerificationNotice("The new code request was accepted. Check your inbox and spam folder.");
            setResendSeconds(30);
        } catch (requestError) {
            setError(requestError.message || "Could not resend the code. Please try again.");
            if (requestError.message?.includes("30 seconds")) setResendSeconds(30);
        } finally {
            setBusy(false);
        }
    }

    function switchMode(nextMode) {
        setError("");
        setFieldErrors({});
        navigate(nextMode === "signup" ? "/signup" : "/signin");
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        setFieldErrors({});
        try {
            const nextFieldErrors = {};
            if (mode === "verify" || mode === "reset") {
                if (!verificationEmail) {
                    setError(mode === "verify"
                        ? "The signup email is missing. Return to sign up and request a new code."
                        : "The reset email is missing. Request a new code to continue.");
                    return;
                }
                if (!/^\d{6}$/.test(verificationCode)) {
                    nextFieldErrors.code = "Enter the six-digit code sent to your email.";
                    setFieldErrors(nextFieldErrors);
                    return;
                }
                if (mode === "verify") {
                    const user = await verifyAccountEmail(verificationEmail, verificationCode);
                    onLogin(user);
                    navigate("/live", { replace: true });
                    return;
                }
                if (password.length < 10) nextFieldErrors.password = "Use at least 10 characters.";
                if (password.length > 128) nextFieldErrors.password = "Use 128 characters or fewer.";
                if (!confirmation) nextFieldErrors.confirmation = "Confirm your new password.";
                else if (password !== confirmation) nextFieldErrors.confirmation = "Passwords do not match.";
                if (Object.keys(nextFieldErrors).length) {
                    setFieldErrors(nextFieldErrors);
                    return;
                }
                await resetAccountPassword({
                    email: verificationEmail,
                    code: verificationCode,
                    new_password: password,
                });
                navigate("/signin?passwordReset=success", { replace: true });
                return;
            }

            const emailInput = event.currentTarget.elements.email;
            if (!email.trim()) nextFieldErrors.email = "Enter your email address.";
            else if (emailInput.validity.typeMismatch) nextFieldErrors.email = "Enter a valid email address.";
            if (mode === "signin" && !password) nextFieldErrors.password = "Enter your password.";

            if (mode === "signup") {
                if (!fullName.trim()) nextFieldErrors.fullName = "Enter your full name.";
                if (fullName.trim().length > 150) nextFieldErrors.fullName = "Use 150 characters or fewer.";
                if (password.length < 10) nextFieldErrors.password = "Use at least 10 characters.";
                if (password.length > 128) nextFieldErrors.password = "Use 128 characters or fewer.";
                if (!confirmation) nextFieldErrors.confirmation = "Confirm your password.";
                else if (password !== confirmation) nextFieldErrors.confirmation = "Passwords do not match.";
                if (!agreeToTerms) nextFieldErrors.terms = "You must agree to the Terms of Service and Privacy Policy.";
            }
            if (Object.keys(nextFieldErrors).length) {
                setFieldErrors(nextFieldErrors);
                return;
            }

            if (mode === "forgot") {
                await requestPasswordReset(email.trim().toLowerCase());
                navigate(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`, { replace: true });
            } else if (mode === "signup") {
                await signUpAccount({
                    full_name: fullName.trim(),
                    email: email.trim(),
                    password,
                });
                navigate(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`, { replace: true });
            } else {
                const user = await signInAccount({ email: email.trim(), password, remember: rememberMe });
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
    const isForgot = mode === "forgot";
    const isReset = mode === "reset";
    const passwordResetComplete = new URLSearchParams(location.search).get("passwordReset") === "success";

    return (
        <main className="auth-shell max-[900px]:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.15fr)] max-[680px]:h-auto max-[680px]:min-h-dvh max-[680px]:overflow-visible max-[680px]:grid-cols-[minmax(0,1fr)]">
            <aside className="auth-story max-[680px]:min-h-[300px] max-[380px]:min-h-[270px] before:max-[680px]:bg-[linear-gradient(90deg,rgba(251,251,246,0.97)_0%,rgba(251,251,246,0.90)_54%,rgba(251,251,246,0.25)_100%)]">
                <img alt="" aria-hidden="true" className="auth-story-image" src="/camera-auth.webp" />
                <div className="auth-story-content max-[900px]:pr-[28px] max-[900px]:pl-[36px] max-[680px]:p-[28px_28px_30px] [@media(max-height:760px)_and_(min-width:681px)]:py-[18px] max-[380px]:px-[20px]">
                    <div className="auth-brand max-[680px]:gap-[10px] max-[680px]:mb-[24px] [@media(max-height:760px)_and_(min-width:681px)]:mb-[16px]">
                        <SignalLogo className="size-14 shrink-0 max-[680px]:w-[42px] max-[680px]:h-[42px]" />
                        <div>
                            <p className="text-base font-bold tracking-[0.24em] text-stone-900">SIGNAL</p>
                            <p className="text-xs font-medium tracking-[0.12em] text-stone-500">RTSP STREAM VIEWER</p>
                        </div>
                    </div>
                    <div className="auth-pitch">
                        <h2 className="max-[900px]:text-[clamp(34px,5vw,48px)] max-[680px]:text-[34px] [@media(max-height:760px)_and_(min-width:681px)]:text-[clamp(30px,3vw,42px)]">Monitor Your<br />Cameras in<br /><span>Real Time</span></h2>
                        <p className="auth-story-copy max-[680px]:max-w-[310px] max-[680px]:mt-[10px] max-[680px]:text-[14px]">Add RTSP stream URLs and view live video streams from your cameras, all in one place.</p>
                    </div>
                    <ul className="auth-benefits max-[680px]:hidden [@media(max-height:760px)_and_(min-width:681px)]:gap-[7px] [@media(max-height:760px)_and_(min-width:681px)]:mt-[13px]">
                        <li><span className="auth-benefit-icon max-[900px]:w-[48px] max-[900px]:h-[48px] max-[900px]:text-[22px] [@media(max-height:760px)_and_(min-width:681px)]:w-[42px] [@media(max-height:760px)_and_(min-width:681px)]:h-[42px] [@media(max-height:760px)_and_(min-width:681px)]:text-[19px]"><FiCamera aria-hidden="true" /></span><span><strong>Live Streaming</strong><small className="max-[900px]:text-[12px]">Watch your RTSP streams in real time</small></span></li>
                        <li><span className="auth-benefit-icon max-[900px]:w-[48px] max-[900px]:h-[48px] max-[900px]:text-[22px] [@media(max-height:760px)_and_(min-width:681px)]:w-[42px] [@media(max-height:760px)_and_(min-width:681px)]:h-[42px] [@media(max-height:760px)_and_(min-width:681px)]:text-[19px]"><FiGrid aria-hidden="true" /></span><span><strong>Multiple Streams</strong><small className="max-[900px]:text-[12px]">View multiple cameras in a grid layout</small></span></li>
                        <li><span className="auth-benefit-icon max-[900px]:w-[48px] max-[900px]:h-[48px] max-[900px]:text-[22px] [@media(max-height:760px)_and_(min-width:681px)]:w-[42px] [@media(max-height:760px)_and_(min-width:681px)]:h-[42px] [@media(max-height:760px)_and_(min-width:681px)]:text-[19px]"><FiPlayCircle aria-hidden="true" /></span><span><strong>Simple Controls</strong><small className="max-[900px]:text-[12px]">Play, pause and manage your streams</small></span></li>
                        <li><span className="auth-benefit-icon max-[900px]:w-[48px] max-[900px]:h-[48px] max-[900px]:text-[22px] [@media(max-height:760px)_and_(min-width:681px)]:w-[42px] [@media(max-height:760px)_and_(min-width:681px)]:h-[42px] [@media(max-height:760px)_and_(min-width:681px)]:text-[19px]"><FiShield aria-hidden="true" /></span><span><strong>Secure &amp; Private</strong><small className="max-[900px]:text-[12px]">Your streams, your control</small></span></li>
                    </ul>
                </div>
            </aside>

            <section className="auth-form-panel max-[680px]:!overflow-y-auto max-[680px]:!px-6 max-[680px]:!pb-6">
                {!isVerify && !isReset && !isForgot && (
                    <div aria-label="Account access" className="auth-tabs-bar" role="group">
                        <button aria-pressed={!isSignup} className={!isSignup ? "active" : ""} onClick={() => switchMode("signin")} type="button">Sign In</button>
                        <button aria-pressed={isSignup} className={isSignup ? "active" : ""} onClick={() => switchMode("signup")} type="button">Sign Up</button>
                    </div>
                )}
                <div className={`auth-content [@media(max-height:760px)_and_(min-width:681px)]:!py-[6px] max-[680px]:!flex-none max-[680px]:!py-[16px_0_24px] ${isSignup ? "!justify-start !pt-[clamp(8px,1.1vh,14px)]" : ""}`}>

                    <header className="auth-heading max-[680px]:!mt-[28px] [@media(max-height:760px)_and_(min-width:681px)]:!mt-[15px] [@media(max-height:760px)_and_(min-width:681px)]:!mb-[8px]">
                        <h1 className="max-[680px]:!text-[30px] [@media(max-height:760px)_and_(min-width:681px)]:!text-[clamp(28px,2.7vw,38px)]">
                            {isVerify ? "Verify your email"
                                : isReset ? "Choose a new password"
                                    : isForgot ? "Forgot your password?"
                                        : isSignup ? "Create Your Account" : "Welcome Back"}
                        </h1>
                        <p className="[@media(max-height:760px)_and_(min-width:681px)]:!mt-[3px] [@media(max-height:760px)_and_(min-width:681px)]:!text-[15px]">
                            {isVerify
                                ? "Your account will be created after your email code is confirmed."
                                : isReset ? "Verify the email code to reset your password."
                                    : isForgot ? "Enter your account email and we’ll send a reset code if it matches an account."
                                        : isSignup
                                            ? "Sign up to get started with Signal"
                                            : "Sign in to your account to continue"}
                        </p>
                    </header>

                    {passwordResetComplete && !isForgot && !isReset && !isVerify && (
                        <p className="auth-success" role="status">
                            Password reset complete. Sign in with your new password.
                        </p>
                    )}

                    {isVerify || isReset ? (
                        <form className="auth-form max-[680px]:mt-[26px] [@media(max-height:760px)_and_(min-width:681px)]:!gap-[5px] [@media(max-height:760px)_and_(min-width:681px)]:mt-[14px]" noValidate onSubmit={submit}>
                            <div className="w-full max-w-[560px] self-center rounded-2xl border border-stone-200 bg-white/80 p-6 shadow-sm max-[680px]:p-5">
                                <div className="mb-5 flex items-start gap-3">
                                    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-50 text-xl text-emerald-700"><FiMail /></span>
                                    <div>
                                        <p className="text-sm leading-6 text-slate-600">
                                            Enter the six-digit code requested for <span className="font-semibold text-slate-800">{verificationEmail || "your email"}</span>.
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">It expires in 10 minutes. Check spam or promotions if it doesn’t arrive.</p>
                                    </div>
                                </div>
                                <FormAlert>{error}</FormAlert>
                                {verificationNotice && <p aria-live="polite" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800" role="status">{verificationNotice}</p>}
                                <AuthInput
                                    autoComplete="one-time-code"
                                    error={fieldErrors.code}
                                    id="verification-code"
                                    inputMode="numeric"
                                    label={isReset ? "Password reset code" : "Email verification code"}
                                    maxLength={6}
                                    onChange={(value) => updateField("code", setVerificationCode, value.replace(/\D/g, "").slice(0, 6))}
                                    placeholder="Enter your 6-digit code"
                                    type="text"
                                    value={verificationCode}
                                />
                                {isReset && (
                                    <>
                                        <AuthInput autoComplete="new-password" error={fieldErrors.password} id="password" label="New password" maxLength={128} onChange={(value) => updateField("password", setPassword, value)} type="password" value={password} />
                                        <AuthInput autoComplete="new-password" error={fieldErrors.confirmation} id="confirm-password" label="Confirm new password" maxLength={128} onChange={(value) => updateField("confirmation", setConfirmation, value)} type="password" value={confirmation} />
                                    </>
                                )}
                                <button className="auth-submit brand-gradient [@media(max-height:760px)_and_(min-width:681px)]:min-h-[44px]" disabled={busy} type="submit">
                                    {busy ? "Please wait…" : isReset ? "Reset password" : "Verify email and continue"}
                                </button>
                                {isVerify ? (
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4 text-sm">
                                        <button className="inline-flex items-center gap-2 font-semibold text-emerald-700 transition hover:text-emerald-900 disabled:cursor-not-allowed disabled:text-slate-400" disabled={busy || resendSeconds > 0} onClick={resendCode} type="button">
                                            <FiRefreshCw aria-hidden="true" />
                                            {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}
                                        </button>
                                        <Link className="font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline" to={`/signup?email=${encodeURIComponent(verificationEmail)}`}>Change email</Link>
                                    </div>
                                ) : (
                                    <Link className="auth-secondary-link" to="/forgot-password">Request a new reset code</Link>
                                )}
                            </div>
                        </form>
                    ) : isForgot ? (
                        <form className="auth-form max-[680px]:mt-[26px] [@media(max-height:760px)_and_(min-width:681px)]:!gap-[5px] [@media(max-height:760px)_and_(min-width:681px)]:mt-[14px]" noValidate onSubmit={submit}>
                            <FormAlert>{error}</FormAlert>
                            <AuthInput autoComplete="email" error={fieldErrors.email} id="email" label="Email address" maxLength={254} onChange={(value) => updateField("email", setEmail, value)} placeholder="Enter your email" type="email" value={email} />
                            <button className="auth-submit brand-gradient [@media(max-height:760px)_and_(min-width:681px)]:min-h-[44px]" disabled={busy} type="submit">
                                {busy ? "Sending code…" : "Send reset code"}
                            </button>
                            <Link className="auth-secondary-link" to="/signin">
                                Back to sign in
                            </Link>
                        </form>
                    ) : (
                        <>
                            <form className={`auth-form max-[680px]:mt-[26px] [@media(max-height:760px)_and_(min-width:681px)]:!gap-[5px] [@media(max-height:760px)_and_(min-width:681px)]:mt-[14px] ${isSignup ? "!gap-[clamp(10px,1.4vh,16px)]" : ""}`} noValidate onSubmit={submit}>
                                <FormAlert>{error}</FormAlert>
                                {isSignup ? (
                                    <>
                                        <AuthInput
                                            autoComplete="name"
                                            error={fieldErrors.fullName}
                                            id="full-name"
                                            label="Full name"
                                            maxLength={150}
                                            onChange={(value) => updateField("fullName", setFullName, value)}
                                            placeholder="Full name"
                                            roomy
                                            value={fullName}
                                        />
                                        <AuthInput
                                            autoComplete="email"
                                            error={fieldErrors.email}
                                            id="email"
                                            label="Email address"
                                            maxLength={254}
                                            onChange={(value) => updateField("email", setEmail, value)}
                                            placeholder="Email address"
                                            roomy
                                            type="email"
                                            value={email}
                                        />
                                        <AuthInput
                                            autoComplete="new-password"
                                            error={fieldErrors.password}
                                            id="password"
                                            label="Password"
                                            maxLength={128}
                                            onChange={(value) => updateField("password", setPassword, value)}
                                            placeholder="Password"
                                            roomy
                                            type="password"
                                            value={password}
                                        />
                                        <AuthInput
                                            autoComplete="new-password"
                                            error={fieldErrors.confirmation}
                                            id="confirm-password"
                                            label="Confirm password"
                                            maxLength={128}
                                            onChange={(value) => updateField("confirmation", setConfirmation, value)}
                                            placeholder="Confirm password"
                                            roomy
                                            type="password"
                                            value={confirmation}
                                        />
                                        <div className="auth-terms-field">
                                            <label className="auth-remember">
                                                <input
                                                    checked={agreeToTerms}
                                                    onChange={(event) => updateField("terms", setAgreeToTerms, event.target.checked)}
                                                    type="checkbox"
                                                />
                                                <span className="auth-terms-text">
                                                    I agree to the{" "}
                                                    <a className="auth-terms-link" href="#" onClick={(e) => e.preventDefault()}>
                                                        Terms of Service
                                                    </a>{" "}
                                                    and{" "}
                                                    <a className="auth-terms-link" href="#" onClick={(e) => e.preventDefault()}>
                                                        Privacy Policy
                                                    </a>
                                                </span>
                                            </label>
                                            {fieldErrors.terms && (
                                                <p className="text-xs font-normal text-rose-700">{fieldErrors.terms}</p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <AuthInput
                                            autoComplete="username"
                                            error={fieldErrors.email}
                                            id="email"
                                            label="Email address"
                                            maxLength={254}
                                            onChange={(value) => updateField("email", setEmail, value)}
                                            placeholder="Enter your email"
                                            type="email"
                                            value={email}
                                        />
                                        <AuthInput
                                            autoComplete="current-password"
                                            error={fieldErrors.password}
                                            id="password"
                                            label="Password"
                                            maxLength={128}
                                            onChange={(value) => updateField("password", setPassword, value)}
                                            placeholder="Enter your password"
                                            type="password"
                                            value={password}
                                        />
                                        <div className="auth-options-row">
                                            <label className="auth-remember">
                                                <input
                                                    checked={rememberMe}
                                                    onChange={(event) => setRememberMe(event.target.checked)}
                                                    type="checkbox"
                                                />
                                                <span>Remember me</span>
                                            </label>
                                            <Link className="auth-forgot-link" to="/forgot-password">
                                                Forgot password?
                                            </Link>
                                        </div>
                                    </>
                                )}
                                <button className={`auth-submit brand-gradient [@media(max-height:760px)_and_(min-width:681px)]:!min-h-[44px] ${isSignup ? "!min-h-[clamp(54px,6.8vh,68px)] !text-[18px]" : ""}`} disabled={busy} type="submit">
                                    {busy ? "Please wait…" : isSignup ? "Sign Up" : "Sign In"}
                                </button>
                            </form>

                            <div className="auth-divider [@media(max-height:760px)_and_(min-width:681px)]:![margin:5px_0_4px]">
                                <span>OR</span>
                            </div>

                            <button
                                className={`auth-google-btn [@media(max-height:760px)_and_(min-width:681px)]:!min-h-[44px] ${isSignup ? "!min-h-[clamp(54px,6.8vh,68px)] !text-[18px]" : ""}`}
                                disabled={googleBusy}
                                type="button"
                                onClick={() => {
                                    setGoogleBusy(true);
                                    window.location.href = `${import.meta.env.VITE_API_URL || "https://rtsp-stream-viewer-api.onrender.com"}/api/auth/google/`;
                                }}
                            >
                                <svg viewBox="0 0 48 48" className="size-5 shrink-0">
                                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                                    <path fill="none" d="M0 0h48v48H0z" />
                                </svg>
                                Continue with Google
                            </button>

                            <p className="auth-switch-prompt [@media(max-height:760px)_and_(min-width:681px)]:!mt-[6px]">
                                {isSignup ? "Already have an account? " : "Don't have an account? "}
                                <button onClick={() => switchMode(isSignup ? "signin" : "signup")} type="button">
                                    {isSignup ? "Sign In" : "Sign Up"}
                                </button>
                            </p>
                        </>
                    )}
                </div>
            </section>
        </main>
    );
}

