/**
 * POST JSON to one of our AI routes and stream the plain-text response.
 * Calls onText with the full text so far on every chunk. Throws with the
 * server's error message on non-2xx responses.
 */
export async function streamText(
  url: string,
  body: unknown,
  onText: (textSoFar: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  text += decoder.decode();
  onText(text);
  return text;
}
