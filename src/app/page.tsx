import StatusPanel from "@/components/StatusPanel";
import GapPanel from "@/components/GapPanel";
import AskPanel from "@/components/AskPanel";
import CorpusList from "@/components/CorpusList";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          Hawaiʻi BEAD Explorer
        </h1>
        <p className="text-sm text-zinc-300">
          A weekend exploration of Hawaiʻi&apos;s public BEAD documents. Answers are
          grounded only in the loaded sources; every value shows its receipt.
        </p>
        <p className="text-xs text-zinc-500">
          Not affiliated with the State of Hawaiʻi, the University of Hawaiʻi,
          NTIA, the FCC, or any vendor.
        </p>
      </header>
      <StatusPanel />
      <GapPanel />
      <AskPanel />
      <CorpusList />
      <footer className="mt-4 flex flex-col gap-1 text-xs text-zinc-500">
        <a
          className="text-sky-400 hover:text-sky-300"
          href="https://github.com/tclum/bead-explorer"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/tclum/bead-explorer
        </a>
      </footer>
    </main>
  );
}
