"use client"
import { redirect } from "next/navigation";
import { useIsOperating, OPEN_MIN, CLOSE_MIN, fmtTime } from "./operating"

export default function Header() {
    const operating = useIsOperating();
    return (
        <header className="relative w-full shrink-0 overflow-hidden px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] shadow-lg">
            {/* soft decorative circles */}
            <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full" />
            <div className="pointer-events-none absolute -left-8 bottom-[-40px] h-24 w-24 rounded-full" />

            <div className="relative grid grid-cols-[44px_1fr_44px] items-center">
                {/* logo in a white badge so it pops on the blue */}
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md ring-2">
                    <img src="/its.png" alt="ITS" className="h-24 w-24 object-contain" />
                </div>

                <div className="text-center">
                    <h1 className="text-xl font-extrabold tracking-wider text-white drop-shadow" onClick={()=>redirect("/")}>
                        BUGGYCARKU
                    </h1>
                    <div className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        <span className="relative flex h-2 w-2">
                            {operating && (
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                            )}
                            <span
                                className={`relative inline-flex h-2 w-2 rounded-full ${operating ? "bg-green-400" : "bg-gray-400"
                                    }`}
                            />
                        </span>
                        {operating ? "LIVE · Campus Shuttle" : "OFFLINE · Service ended"}
                    </div>
                </div>

                <button
                    type="button"
                    aria-label="Info"
                    className="flex h-11 w-11 items-center justify-center justify-self-end rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
                    onClick={()=>redirect("/information")}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="h-6 w-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="12" cy="12" r="9.5" />
                        <path d="M12 11v5.5" />
                        <circle cx="12" cy="7.6" r="0.6" fill="currentColor" />
                    </svg>
                </button>
            </div>

            <div className="absolute inset-x-0 bottom-0 h-1 bg-[repeating-linear-gradient(90deg,#fbbf24_0_14px,transparent_14px_24px)]" />
        </header>
    )
}