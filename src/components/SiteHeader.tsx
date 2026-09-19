import Link from "next/link";

const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Overview" },
  { href: "/challenge", label: "Challenge process" },
  { href: "/selection", label: "Subgrantee selection" },
  { href: "/oversight", label: "Oversight" },
  { href: "/report", label: "Receipted report" },
];

export default function SiteHeader({ current }: { current: string }) {
  const isHome = current === "/";
  return (
    <header className="mb-6 flex flex-col gap-3">
      {isHome ? (
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-paper md:text-5xl">
          Hawaiʻi BEAD Explorer
        </h1>
      ) : (
        <Link
          href="/"
          className="font-serif text-2xl font-semibold tracking-tight text-paper hover:text-teal"
        >
          Hawaiʻi BEAD Explorer
        </Link>
      )}
      <nav aria-label="Primary" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {NAV.map((n) => {
          const active = n.href === current;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "border-b-2 border-teal pb-0.5 text-paper"
                  : "text-paper-2 hover:text-paper"
              }
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
