"use client";

import { useRef, useState } from "react";
import { streamText } from "@/lib/stream-client";
import { Markdown } from "./Markdown";

const MODES = [
  { id: "deep-dive", label: "🔬 Go deeper", hint: "Under the hood, trade-offs and interview questions" },
  { id: "simpler", label: "🧸 Explain it simpler", hint: "Analogies and a step-by-step walkthrough" },
  { id: "examples", label: "🏢 More real-world examples", hint: "How production systems use this" },
] as const;

export function AiExplain({ slug }: { slug: string }) {
  const [mode, setMode] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run(id: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setMode(id);
    setText("");
    setError(null);
    setLoading(true);
    try {
      await streamText("/api/explain", { slug, mode: id }, setText, controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }

  return (
    <div className="mt-12 rounded-xl border border-violet-200 bg-violet-50/60 p-5 dark:border-violet-900 dark:bg-violet-950/30">
      <h3 className="font-semibold">🤖 Want more? Ask your AI mentor</h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Generate a fresh explanation tailored to how you learn best.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            title={m.hint}
            disabled={loading && mode === m.id}
            onClick={() => run(m.id)}
            className={`rounded-md border px-3 py-1.5 text-sm transition disabled:opacity-60 ${
              mode === m.id
                ? "border-violet-500 bg-violet-600 text-white"
                : "border-violet-300 bg-white hover:bg-violet-100 dark:border-violet-800 dark:bg-zinc-900 dark:hover:bg-violet-950"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>}

      {(text || loading) && !error && (
        <div className="mt-5 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          {text ? <Markdown>{text}</Markdown> : <p className="animate-pulse text-sm text-zinc-500">Thinking…</p>}
        </div>
      )}
    </div>
  );
}
