"use client";

import { useEffect, useRef, useState } from "react";
import { streamText } from "@/lib/stream-client";
import { Markdown } from "./Markdown";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Can you explain this topic with an analogy?",
  "What mistakes do beginners make here?",
  "How would a big company like Amazon handle this?",
  "Give me a hint for the practice problem",
];

export function MentorChat({ slug, topicTitle }: { slug: string; topicTitle: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const history: Message[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      await streamText("/api/chat", { slug, messages: history }, (reply) =>
        setMessages([...history, { role: "assistant", content: reply }]),
      );
    } catch (err) {
      setMessages(history.slice(0, -1));
      setInput(content);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-violet-500"
      >
        💬 Ask the mentor
      </button>
    );
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 flex h-[70vh] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[420px] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <p className="text-sm font-semibold">AI Backend Mentor</p>
          <p className="text-xs text-zinc-500">Topic: {topicTitle}</p>
        </div>
        <div className="flex gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            aria-label="Close chat"
            onClick={() => setOpen(false)}
            className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-zinc-500">Stuck or curious? Ask anything about this topic.</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-8 rounded-lg bg-violet-600 px-3 py-2 text-sm text-white">
              {m.content}
            </div>
          ) : (
            <div key={i} className="mr-4 rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
              {m.content ? (
                <Markdown className="prose-sm">{m.content}</Markdown>
              ) : (
                <p className="animate-pulse text-sm text-zinc-500">Thinking…</p>
              )}
            </div>
          ),
        )}
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          placeholder="Ask a question… (Shift+Enter for a new line)"
          className="flex-1 resize-none rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-md bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
