"use client";

import { Button } from "../components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-xl border border-line bg-panel p-8 text-center">
      <h1 className="font-display text-3xl font-extrabold uppercase text-ink">
        Something went wrong
      </h1>
      <p className="mt-3 text-sm text-muted">{error.message}</p>
      <Button type="button" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
