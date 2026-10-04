
const apiUrl = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:8000"
    : "https://rtsp-stream-viewer-api.onrender.com")
).replace(/\/+$/, "");

console.log("apiUrl:", apiUrl);

const AUTH_TOKEN_KEY = "signal_access_token_v2";
const LEGACY_AUTH_TOKEN_KEY = "signal_access_token";
const SIGNUP_CHALLENGE_KEY = "signal_pending_signup_challenge";
const SIGNUP_CODE_EXPIRES_AT_KEY = "signal_signup_code_expires_at";
const SIGNUP_RESEND_AT_KEY = "signal_signup_resend_at";
const PASSWORD_RESET_CHALLENGE_KEY = "signal_pending_password_reset";

function saveSignupChallenge(result) {
    window.sessionStorage.setItem(SIGNUP_CHALLENGE_KEY, result.challenge_token);
    if (Number.isFinite(result.code_expires_at)) {
        window.sessionStorage.setItem(SIGNUP_CODE_EXPIRES_AT_KEY, String(result.code_expires_at * 1000));
    }
    const resendAt = Date.now() + Math.max(0, Number(result.resend_after_seconds) || 0) * 1000;
    window.sessionStorage.setItem(SIGNUP_RESEND_AT_KEY, String(resendAt));
}

export function getSignupVerificationTiming() {
    let expiresAt = Number(window.sessionStorage.getItem(SIGNUP_CODE_EXPIRES_AT_KEY));
    let resendAt = Number(window.sessionStorage.getItem(SIGNUP_RESEND_AT_KEY));
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
        expiresAt = Date.now() + 10 * 60 * 1000;
        window.sessionStorage.setItem(SIGNUP_CODE_EXPIRES_AT_KEY, String(expiresAt));
    }
    if (!Number.isFinite(resendAt) || resendAt <= 0) {
        resendAt = Date.now();
        window.sessionStorage.setItem(SIGNUP_RESEND_AT_KEY, String(resendAt));
    }
    return { codeExpiresAt: expiresAt, resendAt };
}

export function deferSignupResend(seconds = 30) {
    const resendAt = Date.now() + Math.max(0, seconds) * 1000;
    window.sessionStorage.setItem(SIGNUP_RESEND_AT_KEY, String(resendAt));
    return resendAt;
}

// Tokens from the pre-authentication workspace must not silently sign visitors in.
window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);

export function getAuthToken() {
    return window.localStorage.getItem(AUTH_TOKEN_KEY)
        || window.sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function saveAuthToken(token, remember = true) {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    (remember ? window.localStorage : window.sessionStorage).setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getGoogleOAuthUrl() {
    return `${apiUrl}/api/auth/google/`;
}

export function consumeGoogleOAuthToken() {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const token = hashParams.get("googleToken");
    if (!token) return null;
    window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
    );
    return token;
}

async function apiRequest(path, options = {}) {
    const token = getAuthToken();
    const response = await fetch(`${apiUrl}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });
    if (!response.ok) {
        if (response.status === 401) {
            clearAuthToken();
            window.dispatchEvent(new Event("signal:auth-expired"));
        }
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Camera service returned ${response.status}.`);
    }
    return response.status === 204 ? null : response.json();
}

export function signUpAccount({ full_name, email, password }) {
    return apiRequest("/api/auth/signup/", {
        method: "POST",
        body: JSON.stringify({ full_name, email, password }),
    }).then((result) => {
        saveSignupChallenge(result);
        return result;
    });
}

export async function resendSignupVerification(email) {
    const challengeToken = window.sessionStorage.getItem(SIGNUP_CHALLENGE_KEY);
    if (!challengeToken) {
        throw new Error("Your signup session expired. Start signup again to request a new code.");
    }
    const result = await apiRequest("/api/auth/signup/resend/", {
        method: "POST",
        body: JSON.stringify({ email, challenge_token: challengeToken }),
    });
    saveSignupChallenge(result);
    return result;
}

export async function signInAccount({ email, password, remember = true }) {
    const result = await apiRequest("/api/auth/signin/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
    saveAuthToken(result.token, remember);
    return result.user;
}

export function getCurrentAccount() {
    return apiRequest("/api/auth/me/");
}

export async function verifyAccountEmail(email, code) {
    const challengeToken = window.sessionStorage.getItem(SIGNUP_CHALLENGE_KEY);
    if (!challengeToken) {
        throw new Error("Your verification session expired. Please sign up again to request a new code.");
    }
    const result = await apiRequest("/api/auth/verify-email/", {
        method: "POST",
        body: JSON.stringify({ email, code, challenge_token: challengeToken }),
    });
    window.sessionStorage.removeItem(SIGNUP_CHALLENGE_KEY);
    window.sessionStorage.removeItem(SIGNUP_CODE_EXPIRES_AT_KEY);
    window.sessionStorage.removeItem(SIGNUP_RESEND_AT_KEY);
    saveAuthToken(result.token);
    return result.user;
}

export async function requestPasswordReset(email) {
    const result = await apiRequest("/api/auth/password-reset/request/", {
        method: "POST",
        body: JSON.stringify({ email }),
    });
    if (!result.challenge_token) {
        throw new Error("A reset code could not be prepared. Please try again.");
    }
    window.sessionStorage.setItem(PASSWORD_RESET_CHALLENGE_KEY, result.challenge_token);
    return result;
}

export async function resetAccountPassword({ email, code, new_password }) {
    const challengeToken = window.sessionStorage.getItem(PASSWORD_RESET_CHALLENGE_KEY);
    if (!challengeToken) {
        throw new Error("Your reset session expired. Request a new code.");
    }
    const result = await apiRequest("/api/auth/password-reset/confirm/", {
        method: "POST",
        body: JSON.stringify({ email, code, new_password, challenge_token: challengeToken }),
    });
    window.sessionStorage.removeItem(PASSWORD_RESET_CHALLENGE_KEY);
    return result;
}

export function listCameras() {
    return apiRequest("/api/cameras/");
}

export async function saveCamera(camera) {
    const result = await apiRequest("/api/cameras/", {
        method: "POST",
        body: JSON.stringify(camera),
    });
    return result.camera;
}

export function deleteSavedCamera(cameraId) {
    return apiRequest(`/api/cameras/${cameraId}/`, { method: "DELETE" });
}

export function getStreamSocketUrl() {
    const configuredSocketUrl = import.meta.env.VITE_STREAM_WS_URL?.trim();
    if (configuredSocketUrl) return configuredSocketUrl;

    const backendUrl = new URL(apiUrl);
    backendUrl.protocol = backendUrl.protocol === "https:" ? "wss:" : "ws:";
    backendUrl.pathname = `${backendUrl.pathname.replace(/\/+$/, "")}/ws/streams/`;
    backendUrl.search = "";
    backendUrl.hash = "";
    return backendUrl.toString();
}

export function testStreamConnection({ url }) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(getStreamSocketUrl());
        let settled = false;
        let closed = false;
        let releaseTimeout;
        const timeout = window.setTimeout(() => {
            fail(new Error("No video arrived before the connection test timed out."));
        }, 23000);

        function stop() {
            if (closed) return;
            closed = true;
            window.clearTimeout(releaseTimeout);
            window.clearTimeout(timeout);
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "stop" }));
            }
            socket.close();
        }

        function fail(error) {
            if (settled) return;
            settled = true;
            stop();
            reject(error);
        }

        socket.onmessage = (event) => {
            if (typeof event.data !== "string") return;
            let message;
            try {
                message = JSON.parse(event.data);
            } catch {
                return;
            }

            if (message.type === "ready") {
                socket.send(JSON.stringify({ type: "auth", token: getAuthToken() }));
            } else if (message.type === "authenticated") {
                socket.send(JSON.stringify({ type: "start", url }));
            } else if (message.type === "status" && message.status === "live") {
                if (!settled) {
                    settled = true;
                    window.clearTimeout(timeout);
                    resolve({
                        isOpen: () => socket.readyState === WebSocket.OPEN,
                        release: () => {
                            window.clearTimeout(releaseTimeout);
                            releaseTimeout = window.setTimeout(stop, 0);
                        },
                        socket,
                        stop,
                        take: () => {
                            window.clearTimeout(releaseTimeout);
                            return !closed && socket.readyState === WebSocket.OPEN ? socket : null;
                        },
                    });
                }
            } else if (message.type === "error") {
                fail(new Error(message.message || "The stream connection failed."));
            }
        };
        socket.onerror = () => fail(new Error("Could not reach the stream service."));
        socket.onclose = () => {
            if (!settled) fail(new Error("The stream service closed the test connection."));
        };
    });
}
