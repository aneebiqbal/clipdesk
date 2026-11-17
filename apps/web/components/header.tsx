import Link from "next/link";

export function Header() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link
        href="/"
        className="flex items-center gap-2.5 font-display text-2xl font-extrabold uppercase tracking-tight text-ink"
      >
        <span className="h-3 w-3 rounded-full bg-accent" aria-hidden="true" />
        Clipdesk
      </Link>
      <nav className="flex items-center gap-1" aria-label="Main">
        <Link
          href="/"
          className="rounded-md px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-ink"
        >
          New run
        </Link>
        <Link
          href="/library"
          className="rounded-md px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-ink"
        >
          Library
        </Link>
        <Link
          href="/settings"
          className="rounded-md px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-ink"
        >
          Settings
        </Link>
      </nav>
    </header>
  );
}
