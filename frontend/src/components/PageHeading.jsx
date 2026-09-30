export default function PageHeading({ action, description, title }) {
    return (
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
                <h2 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h2>
                {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
            </div>
            {action}
        </div>
    );
}
