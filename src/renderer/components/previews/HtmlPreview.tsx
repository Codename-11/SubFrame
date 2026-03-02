import { useDeferredValue } from 'react';

interface HtmlPreviewProps {
  content: string;
  filePath: string;
}

function wrapCssForPreview(cssContent: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${cssContent}</style></head>
<body style="padding:24px;font-family:system-ui,-apple-system,sans-serif;">
<h1>Heading 1</h1>
<h2>Heading 2</h2>
<h3>Heading 3</h3>
<p>Paragraph with <a href="#">a link</a>, <strong>bold text</strong>, and <em>italic text</em>. This is sample content to preview your CSS styles.</p>
<ul><li>Unordered list item 1</li><li>Unordered list item 2</li><li>Unordered list item 3</li></ul>
<ol><li>Ordered list item 1</li><li>Ordered list item 2</li></ol>
<blockquote>This is a blockquote element for testing styles.</blockquote>
<pre><code>const example = "code block";</code></pre>
<table><thead><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr></thead>
<tbody><tr><td>Cell 1</td><td>Cell 2</td><td>Cell 3</td></tr>
<tr><td>Cell 4</td><td>Cell 5</td><td>Cell 6</td></tr></tbody></table>
<div style="margin-top:16px;display:flex;gap:8px;align-items:center;">
<button>Button</button>
<input type="text" placeholder="Text input">
<select><option>Select option</option></select>
</div>
<hr>
<footer><small>CSS Preview — SubFrame</small></footer>
</body></html>`;
}

// Security: sandbox="" must remain empty (no allow-scripts). Electron runs with
// nodeIntegration:true in the renderer, so an iframe with allow-scripts could
// access Node.js APIs and escape the sandbox entirely.
export function HtmlPreview({ content, filePath }: HtmlPreviewProps) {
  const isCssFile = filePath.toLowerCase().endsWith('.css');
  const deferredContent = useDeferredValue(content);
  const previewHtml = isCssFile ? wrapCssForPreview(deferredContent) : deferredContent;

  return (
    <iframe
      srcDoc={previewHtml}
      sandbox=""
      title="HTML Preview"
      className="w-full h-full border-0"
      style={{ backgroundColor: '#ffffff' }}
    />
  );
}
