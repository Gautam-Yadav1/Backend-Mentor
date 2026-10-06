import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div
      className={`prose prose-zinc dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-h2:mt-10 prose-h2:text-2xl prose-pre:bg-zinc-950 prose-pre:text-zinc-100 prose-pre:border prose-pre:border-zinc-800 prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal dark:prose-code:bg-zinc-800 [&_pre_code]:bg-transparent [&_pre_code]:p-0 prose-table:text-sm prose-blockquote:border-emerald-500 prose-blockquote:not-italic ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
