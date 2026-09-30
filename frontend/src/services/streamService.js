export function getStreamSocketUrl() {
    return import.meta.env.VITE_STREAM_WS_URL
        || `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.hostname}:8000/ws/streams/`;
}

export function testStreamConnection({ accessKey, url }) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(getStreamSocketUrl());
        let settled = false;
        let authenticated = false;
        const timeout = window.setTimeout(() => {
            finish(new Error("No video arrived before the connection test timed out."));
        }, 23000);

        function finish(error) {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "stop" }));
            }
            socket.close();
            if (error) reject(error);
            else resolve();
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
                finish();
            } else if (message.type === "error") {
                finish(new Error(message.message || "The stream connection failed."));
            }
        };
        socket.onerror = () => finish(new Error("Could not reach the stream service."));
        socket.onclose = () => {
            if (!settled) finish(new Error("The stream service closed the test connection."));
        };
    });
}
