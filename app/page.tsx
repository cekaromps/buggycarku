import Header from "./_components/header";
import BuggyMap from "./_components/BuggyMap";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-start bg-zinc-50 font-sans dark:bg-black">
      <Header />
      <p className="px-8 text-justify">Buggy car di Institut Teknologi Sepuluh Nopember (ITS) adalah moda transportasi internal yang disediakan secara gratis untuk memudahkan mobilitas mahasiswa, dosen, staf, maupun pengunjung di dalam area kampus.</p>
      <BuggyMap />
    </div>
  );
}
