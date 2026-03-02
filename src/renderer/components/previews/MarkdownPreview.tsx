import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
        if (href) require('electron').shell.openExternal(href);
      }}
      {...props}
    >
      {children}
    </a>
  ),
  strong: ({ children, ...props }) => (
    <strong className="text-text-primary font-semibold" {...props}>{children}</strong>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-2 border-accent pl-4 italic text-text-tertiary mb-4" {...props}>{children}</blockquote>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-6 mb-3 text-text-secondary text-sm" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-6 mb-3 text-text-secondary text-sm" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="mb-1" {...props}>{children}</li>
  ),
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
    <img src={src} alt={alt ?? ''} className="max-w-full rounded-lg my-4" {...props} />
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
        <pre className="bg-bg-secondary rounded-lg p-4 overflow-x-auto mb-4 scrollbar-thin">
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
    <div className="h-full overflow-y-auto scrollbar-thin">
      <style>{hljsStyles}</style>
      <div className="p-6 max-w-4xl">
        <Markdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </Markdown>
      </div>
    </div>
  );
}
