import { Lexer, type Token, type Tokens } from "marked";
import { Fragment, type ReactNode } from "react";

function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || /[\u0000-\u001F\u007F\\]/.test(trimmed)) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) return trimmed;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:" && protocol !== "mailto:") return null;
  return url.href;
}

function renderTokens(tokens: Token[], keyPrefix: string): ReactNode {
  return tokens.map((token, index) => renderToken(token, `${keyPrefix}-${index}`));
}

function renderList(token: Tokens.List, key: string) {
  const items = token.items.map((item, index) => (
    <li key={`${key}-${index}`} className="mt-1">
      {renderTokens(item.tokens, `${key}-${index}`)}
    </li>
  ));
  if (token.ordered) {
    return (
      <ol key={key} className="list-decimal pl-5" start={typeof token.start === "number" ? token.start : undefined}>
        {items}
      </ol>
    );
  }
  return (
    <ul key={key} className="list-disc pl-5">
      {items}
    </ul>
  );
}

function renderTable(token: Tokens.Table, key: string) {
  return (
    <div key={key} className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {token.header.map((cell, index) => (
              <th key={index} className="border-b border-line py-1 pr-3 text-left font-medium">
                {renderTokens(cell.tokens, `${key}-h-${index}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {token.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-line py-1 pr-3">
                  {renderTokens(cell.tokens, `${key}-${rowIndex}-${cellIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function childTokens(token: Token): Token[] {
  const nested = (token as { tokens?: Token[] }).tokens;
  return Array.isArray(nested) ? nested : [];
}

function tokenText(token: Token): string {
  const text = (token as { text?: string }).text;
  return typeof text === "string" ? text : "";
}

function renderToken(token: Token, key: string): ReactNode {
  switch (token.type) {
    case "space":
    case "def":
      return null;
    case "paragraph":
    case "heading":
      return (
        <p key={key} className={token.type === "heading" ? "font-medium" : undefined}>
          {renderTokens(childTokens(token), key)}
        </p>
      );
    case "text":
      return childTokens(token).length ? (
        <Fragment key={key}>{renderTokens(childTokens(token), key)}</Fragment>
      ) : (
        <Fragment key={key}>{tokenText(token)}</Fragment>
      );
    case "strong":
      return <strong key={key}>{renderTokens(childTokens(token), key)}</strong>;
    case "em":
      return <em key={key}>{renderTokens(childTokens(token), key)}</em>;
    case "del":
      return (
        <span key={key} className="line-through">
          {renderTokens(childTokens(token), key)}
        </span>
      );
    case "codespan":
      return (
        <code key={key} className="rounded bg-paper px-1 py-0.5">
          {tokenText(token)}
        </code>
      );
    case "code":
      return (
        <pre key={key} className="overflow-x-auto rounded-xl bg-paper p-3">
          <code>{tokenText(token)}</code>
        </pre>
      );
    case "list":
      return renderList(token as Tokens.List, key);
    case "blockquote":
      return (
        <blockquote key={key} className="border-l-2 border-line pl-3 text-muted">
          {renderTokens(childTokens(token), key)}
        </blockquote>
      );
    case "br":
      return <br key={key} />;
    case "hr":
      return <hr key={key} className="border-line" />;
    case "html":
    case "escape":
      return <Fragment key={key}>{tokenText(token)}</Fragment>;
    case "link": {
      const href = safeHref((token as Tokens.Link).href);
      const children = renderTokens(childTokens(token), key);
      if (!href) return <Fragment key={key}>{children}</Fragment>;
      return (
        <a key={key} href={href} rel="noreferrer noopener" className="underline">
          {children}
        </a>
      );
    }
    case "image": {
      const image = token as Tokens.Image;
      const nested = childTokens(token);
      return <Fragment key={key}>{nested.length ? renderTokens(nested, key) : image.text}</Fragment>;
    }
    case "table":
      return renderTable(token as Tokens.Table, key);
    default: {
      const nested = childTokens(token);
      if (nested.length) return <Fragment key={key}>{renderTokens(nested, key)}</Fragment>;
      const text = tokenText(token);
      return text ? <Fragment key={key}>{text}</Fragment> : null;
    }
  }
}

/** Markdown as React elements. Raw HTML is text, and links are limited to http, https, and mailto. */
export function SafeMarkdown({ source }: { source: string }) {
  if (!source.trim()) return null;
  const tokens = Lexer.lex(source, { gfm: true, breaks: false });
  return <div className="flex flex-col gap-3 text-sm leading-relaxed break-words">{renderTokens(tokens, "md")}</div>;
}
