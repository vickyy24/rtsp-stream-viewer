export default function SignalLogo({ className = "size-7" }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            fill="none"
            viewBox="0 0 32 32"
        >
            <path
                d="M4 13v6M8 9v14M12 5v22M16 10v12M20 4v24M24 8v16M28 12v8"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2.2"
            />
        </svg>
    );
}
