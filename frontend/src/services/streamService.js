export function getStreamSocketUrl() {
    return import.meta.env.VITE_STREAM_WS_URL
        || `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.hostname}:8000/ws/streams/`;
}

export function testStreamConnection({ accessKey, url }) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(getStreamSocketUrl());
        let settled = false;
        let closed = false;
        let releaseTimeout;
        let authenticated = false;
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

        socket.onopen = () => {
            socket.send(JSON.stringify({ type: "authenticate", key: accessKey }));
        };
        socket.onmessage = (event) => {
            if (typeof event.data !== "string") return;
            let message;
            try {
                message = JSON.parse(event.data);
            } catch {
                return;
            }

            if (message.type === "authenticated" && !authenticated) {
                authenticated = true;
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
