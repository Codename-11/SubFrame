import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Root, Blockquote, Paragraph, Text } from 'mdast';
import type { Plugin } from 'unified';
import { ScrollArea } from '../ui/scroll-area';
import { getTransport } from '../../lib/transportProvider';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import sql from 'highlight.js/lib/languages/sql';
import rust from 'highlight.js/lib/languages/rust';
import cpp from 'highlight.js/lib/languages/cpp';
import java from 'highlight.js/lib/languages/java';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('rs', rust);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c++', cpp);
hljs.registerLanguage('java', java);

const hljsStyles = `
.hljs { color: #e8e6e3; background: #1a1a1c; }
.hljs-keyword { color: #d4a574; }
.hljs-string { color: #7cb382; }
.hljs-number { color: #e0a458; }
.hljs-comment { color: #6b6660; font-style: italic; }
.hljs-function { color: #e8c47a; }
.hljs-title { color: #e8c47a; }
.hljs-type, .hljs-class { color: #78a5d4; }
.hljs-built_in { color: #78a5d4; }
.hljs-attr { color: #78a5d4; }
.hljs-property { color: #c4b5a0; }
.hljs-variable { color: #e8e6e3; }
.hljs-operator { color: #a09b94; }
.hljs-punctuation { color: #6b6660; }
.hljs-meta { color: #6b6660; }
.hljs-regexp { color: #d47878; }
.hljs-literal { color: #e0a458; }
.hljs-symbol { color: #e0a458; }
.hljs-bullet { color: #d4a574; }
.hljs-link { color: #78a5d4; text-decoration: underline; }
.hljs-addition { color: #7cb382; }
.hljs-deletion { color: #d47878; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: bold; }
`;

// GitHub-style alert types and their styling
const ALERT_TYPES: Record<string, { icon: string; label: string; colorClass: string; bgClass: string; borderClass: string }> = {
  NOTE: { icon: 'i', label: 'Note', colorClass: 'text-info', bgClass: 'bg-info/10', borderClass: 'border-info/40' },
  TIP: { icon: '\u2714', label: 'Tip', colorClass: 'text-success', bgClass: 'bg-success/10', borderClass: 'border-success/40' },
  IMPORTANT: { icon: '\u2605', label: 'Important', colorClass: 'text-accent', bgClass: 'bg-accent/10', borderClass: 'border-accent/40' },
  WARNING: { icon: '\u26A0', label: 'Warning', colorClass: 'text-warning', bgClass: 'bg-warning/10', borderClass: 'border-warning/40' },
  CAUTION: { icon: '\u2716', label: 'Caution', colorClass: 'text-error', bgClass: 'bg-error/10', borderClass: 'border-error/40' },
};

// Remark plugin: transform GitHub-style alerts [!NOTE], [!WARNING], etc.
const remarkGithubAlerts: Plugin<[], Root> = () => {
  return (tree: Root) => {
    for (const node of tree.children) {
      if (node.type !== 'blockquote') continue;
      const bq = node as Blockquote;
      if (bq.children.length === 0) continue;

      const firstChild = bq.children[0];
      if (firstChild.type !== 'paragraph') continue;
      const para = firstChild as Paragraph;
      if (para.children.length === 0) continue;

      const firstInline = para.children[0];
      if (firstInline.type !== 'text') continue;
      const textNode = firstInline as Text;

      const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/.exec(textNode.value);
      if (!match) continue;

      const alertType = match[1];
      // Strip the alert marker from the text
      textNode.value = textNode.value.slice(match[0].length);
      // If the text node is now empty, remove it
      if (textNode.value === '') {
        para.children.shift();
        // Also remove leading linebreak if present
        if (para.children.length > 0 && para.children[0].type === 'break') {
          para.children.shift();
        }
      }
      // If the paragraph is now empty, remove it
      if (para.children.length === 0) {
        bq.children.shift();
      }

      // Add data attributes so the blockquote component can detect it
      const data = (bq.data = bq.data || {});
      data.hProperties = { ...(data.hProperties as Record<string, unknown> || {}), 'data-alert-type': alertType };
    }
  };
};

interface MarkdownPreviewProps {
  content: string;
}

const components: Record<string, React.ComponentType<any>> = {
  h1: ({ children, ...props }) => (
    <h1 className="text-2xl font-bold text-accent mb-4 mt-6" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-xl font-semibold text-text-primary mb-3 mt-5" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-lg font-medium text-text-primary mb-2 mt-4" {...props}>{children}</h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-base font-medium text-text-primary mb-2 mt-3" {...props}>{children}</h4>
  ),
  p: ({ children, ...props }) => (
    <p className="text-text-secondary text-sm mb-3 leading-relaxed" {...props}>{children}</p>
  ),
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      className="text-info hover:underline"
      onClick={(e) => {
        e.preventDefault();
        if (href) getTransport().platform.openExternal(href);
      }}
      {...props}
    >
      {children}
    </a>
  ),
  strong: ({ children, ...props }) => (
    <strong className="text-text-primary font-semibold" {...props}>{children}</strong>
  ),
  blockquote: ({ children, ...props }) => {
    const alertType = props['data-alert-type'] as string | undefined;
    if (alertType && ALERT_TYPES[alertType]) {
      const alert = ALERT_TYPES[alertType];
      return (
        <div className={`${alert.bgClass} ${alert.borderClass} border-l-4 rounded-r-lg px-4 py-3 mb-4`} {...props}>
          <div className={`${alert.colorClass} font-semibold text-sm mb-1 flex items-center gap-1.5`}>
            <span>{alert.icon}</span> {alert.label}
          </div>
          <div className="text-text-secondary text-sm [&>p]:mb-1 [&>p:last-child]:mb-0">{children}</div>
        </div>
      );
    }
    return (
      <blockquote className="border-l-2 border-accent pl-4 italic text-text-tertiary mb-4" {...props}>{children}</blockquote>
    );
  },
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-6 mb-3 text-text-secondary text-sm" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-6 mb-3 text-text-secondary text-sm" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => {
    // Detect task list items (GFM checkboxes)
    const childArray = React.Children.toArray(children);
    const firstChild = childArray[0];
    if (React.isValidElement(firstChild) && (firstChild as React.ReactElement<any>).props?.type === 'checkbox') {
      const checked = (firstChild as React.ReactElement<any>).props?.checked;
      return (
        <li className="mb-1 list-none flex items-start gap-2" {...props}>
          <span className={`mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded border ${checked ? 'bg-accent border-accent text-bg-primary' : 'border-border-default'} text-xs flex-shrink-0`}>
            {checked ? '\u2713' : ''}
          </span>
          <span className={checked ? 'line-through text-text-tertiary' : ''}>{childArray.slice(1)}</span>
        </li>
      );
    }
    return (
      <li className="mb-1" {...props}>{children}</li>
    );
  },
  table: ({ children, ...props }) => (
    <table className="w-full border-collapse mb-4 text-sm" {...props}>{children}</table>
  ),
  thead: ({ children, ...props }) => (
    <thead {...props}>{children}</thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody {...props}>{children}</tbody>
  ),
  tr: ({ children, ...props }) => (
    <tr className="border-b border-border-subtle" {...props}>{children}</tr>
  ),
  th: ({ children, ...props }) => (
    <th className="border border-border-subtle bg-bg-tertiary px-3 py-2 text-left text-text-primary font-medium" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border-subtle px-3 py-2 text-text-secondary" {...props}>{children}</td>
  ),
  hr: (props) => (
    <hr className="border-border-subtle my-6" {...props} />
  ),
  img: ({ src, alt, ...props }) => (
    <img src={src} alt={alt ?? ''} className="max-w-full rounded-lg my-4" referrerPolicy="no-referrer" crossOrigin="anonymous" {...props} />
  ),
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const code = String(children).replace(/\n$/, '');
    if (match) {
      let html: string;
      try {
        html = hljs.highlight(code, { language: match[1] }).value;
      } catch {
        html = hljs.highlightAuto(code).value;
      }
      return (
        <pre className="bg-bg-secondary rounded-lg p-4 overflow-x-auto mb-4">
          <code className="text-xs font-mono leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      );
    }
    return (
      <code className="bg-bg-tertiary text-accent px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
    );
  },
};

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <ScrollArea className="h-full">
      <style>{hljsStyles}</style>
      <div className="p-6 max-w-4xl">
        <Markdown remarkPlugins={[remarkGfm, remarkGithubAlerts]} rehypePlugins={[rehypeRaw]} components={components}>
          {content}
        </Markdown>
      </div>
    </ScrollArea>
  );
}
