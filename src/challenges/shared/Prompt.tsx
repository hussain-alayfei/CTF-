import React from 'react';

// Renders a very small, safe subset of markdown used in challenge prompts:
//   `code`, **bold**, and line breaks. No HTML injection — everything is
// turned into React elements.
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on `code` spans first.
  const parts = text.split(/(`[^`]+`)/g);
  parts.forEach((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      nodes.push(<code key={`${keyBase}-c${i}`}>{part.slice(1, -1)}</code>);
      return;
    }
    // Then handle **bold** within the remaining text.
    const bold = part.split(/(\*\*[^*]+\*\*)/g);
    bold.forEach((b, j) => {
      if (b.startsWith('**') && b.endsWith('**')) {
        nodes.push(<strong key={`${keyBase}-b${i}-${j}`}>{b.slice(2, -2)}</strong>);
      } else if (b) {
        nodes.push(<React.Fragment key={`${keyBase}-t${i}-${j}`}>{b}</React.Fragment>);
      }
    });
  });
  return nodes;
}

export default function Prompt({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.split('\n');
  return (
    <div className={`prompt whitespace-pre-wrap leading-relaxed ${className}`}>
      {lines.map((line, i) => (
        <p key={i} className={line.trim() === '' ? 'h-3' : 'mb-2'}>
          {renderInline(line, `l${i}`)}
        </p>
      ))}
    </div>
  );
}
