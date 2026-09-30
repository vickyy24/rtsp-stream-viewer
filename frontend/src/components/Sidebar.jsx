import { LuPanelsTopLeft, LuStar } from "react-icons/lu";
import CameraIcon from "./CameraIcon.jsx";

function NavItem({ active = false, children, icon }) {
    return (
        <button
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                active
                    ? "bg-[var(--color-forest-100)] text-[var(--color-forest-700)]"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
            }`}
            type="button"
        >
            <span className="shrink-0">{icon}</span>
            {children}
            {active && (
                <span className="ml-auto size-1.5 rounded-full bg-[var(--color-olive-500)]" />
            )}
        </button>
    );
}

export default function Sidebar() {
    return (
        <aside className="flex w-full shrink-0 flex-col border-b border-stone-200 bg-[var(--color-surface)] px-5 py-4 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r lg:px-5 lg:py-7">
            <a
                className="flex items-center gap-3 px-1"
                href="#main-content"
                aria-label="Frame home"
            >
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-forest-800)] text-white shadow-sm ">
                    <CameraIcon className="size-5" />
                </span>
                <span>
                    <span className="block text-[15px] font-semibold tracking-tight text-stone-900">
                        Frame
                    </span>
                    <span className="block text-xs text-stone-400">
                        CAMERA WORKSPACE
                    </span>
                </span>
            </a>

            <div className="mt-8 hidden lg:block">
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-stone-400">
                    Workspace
                </p>
                <nav aria-label="Main navigation" className="flex flex-col gap-1">
                    <NavItem active icon={<CameraIcon />}>Live view</NavItem>
                    <NavItem
                        icon={
                            <LuPanelsTopLeft aria-hidden="true" className="size-5" />
                        }
                    >
                        Layouts
                    </NavItem>
                    <NavItem
                        icon={
                            <LuStar aria-hidden="true" className="size-5" />
                        }
                    >
                        Favorites
                    </NavItem>
                </nav>
            </div>

            <div className="mt-5 flex items-center justify-between lg:hidden">
                <span className="text-xs font-medium text-stone-400">YOUR WORKSPACE</span>
                <span className="flex items-center gap-2 text-xs font-medium text-[var(--color-olive-700)]">
                    <span className="size-2 rounded-full bg-[var(--color-olive-500)]" />
                    Local workspace
                </span>
            </div>

            <div className="mt-auto hidden rounded-2xl border border-stone-200 bg-stone-50 p-4 lg:block">
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                    <span className="size-2 rounded-full bg-[var(--color-olive-500)]" />
                    Workspace ready
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-500">
                    Your camera connections will appear here when added.
                </p>
            </div>
        </aside>
    );
}
