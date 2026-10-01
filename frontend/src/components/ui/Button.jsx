const variants = {
    primary: "brand-gradient inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold",
};

export default function Button({ as: Element = "button", className = "", variant, ...props }) {
    const variantClass = variant ? variants[variant] : "";
    return <Element className={`${variantClass} ${className}`.trim()} {...props} />;
}
