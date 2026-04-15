import { marked } from "marked";

export default function MarkdownHtml({ markdown, className = "" }) {
  const html = marked.parse(markdown, {
    gfm: true,
    breaks: true,
  });

  return <article className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

