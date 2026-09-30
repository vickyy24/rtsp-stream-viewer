export default function SignalLogo({ className = "size-7" }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            fill="none"
            viewBox="0 0 32 32"
        >
            <defs>
                <linearGradient id="signal-mark-gradient" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#d94b32" />
                    <stop offset="52%" stopColor="#ee5e35" />
                    <stop offset="100%" stopColor="#f17a3c" />
                </linearGradient>
            </defs>
            <path
                d="M4 13v6M8 9v14M12 5v22M16 10v12M20 4v24M24 8v16M28 12v8"
                stroke="url(#signal-mark-gradient)"
                strokeLinecap="round"
                strokeWidth="2.2"
            />
        </svg>
    );
}
