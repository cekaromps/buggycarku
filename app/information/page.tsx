import Link from "next/link";
import Header from "../_components/header";
import { OPEN_MIN, CLOSE_MIN, fmtTime } from "../_components/schedule";

const STOPS = [
  "Jl. Teknik Elektro",
  "Jl. Teknik Mesin",
  "Taman Alumni",
  "Pemberhentian 4",
  "Teknik Teknologi",
  "Menara Sains",
];

export default function Information() {
  return (
    <>
      <Header />

      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-5">
        {/* Operating hours */}
        <section className="rounded-2xl border border-white/10 bg-gray-900 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Jam Operasional
            </h2>
          </div>

          <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">
            {fmtTime(OPEN_MIN)} <span className="text-amber-300">–</span> {fmtTime(CLOSE_MIN)}
            <span className="ml-2 text-sm font-semibold text-gray-400">WIB</span>
          </p>
        </section>

        {/* Stops */}
        <section className="rounded-2xl border border-white/10 bg-gray-900 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Pemberhentian
          </h2>

          <ol className="mt-4">
            {STOPS.map((name, i) => (
              <li key={i} className="relative flex items-center gap-3 pb-5">
                {/* line connecting this stop to the next one */}
                <span className="absolute bottom-0 left-3.75 top-8 w-0.5 bg-linear-to-b from-blue-500 to-blue-500/30" />
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white ring-4 ring-gray-900">
                  {i + 1}
                </span>
                <span className="text-base font-medium text-gray-100">{name}</span>
              </li>
            ))}

            {/* the route is a loop */}
            <li className="flex items-center gap-3 text-sm text-gray-400">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-base">
                ↻
              </span>
              Lalu kembali ke Pemberhentian 1
            </li>
          </ol>
        </section>

        {/* Tip */}
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Ketuk ikon buggy di peta untuk melihat rute berikutnya.
        </p>

        <Link
          href="/"
          className="flex items-center justify-center rounded-xl bg-blue-600 py-3 font-semibold text-white transition active:scale-[0.98]"
        >
          Kembali ke peta
        </Link>
      </main>
    </>
  );
}