
const apiUrl = (
  import.meta.env.API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:8000"
    : "https://rtsp-stream-viewer-api.onrender.com")
).replace(/\/+$/, "");

console.log("apiUrl:", apiUrl);

const AUTH_TOKEN_KEY = "signal_access_token";

export function getAuthToken() {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function saveAuthToken(token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
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
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Camera service returned ${response.status}.`);
    }
    return response.status === 204 ? null : response.json();
}

export function signUpAccount({ full_name, email, password }) {
    return apiRequest("/api/auth/signup/", {
        method: "POST",
        body: JSON.stringify({ full_name, email, password }),
    });
}

export async function signInAccount({ email, password }) {
    const result = await apiRequest("/api/auth/signin/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
    saveAuthToken(result.token);
    return result.user;
}

export function getCurrentAccount() {
    return apiRequest("/api/auth/me/");
}

export function verifyAccountEmail(token) {
    return apiRequest("/api/auth/verify-email/", {
        method: "POST",
        body: JSON.stringify({ token }),
    });
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

        socket.onopen = () => {};
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
