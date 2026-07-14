import { useEffect, useRef } from 'react';
import useLockBodyScroll from '@/lib/useLockBodyScroll';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app replacement for window.confirm — a readable, on-brand modal instead of
 * the browser's tiny native dialog. Escape cancels; the safe action is focused
 * (Cancel for danger actions, Confirm otherwise) so a stray Enter never nukes data.
 */
export default function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open) return null;
  return <ConfirmDialogInner {...props} />;
}

function ConfirmDialogInner({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useLockBodyScroll();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus the safe choice: Cancel for destructive prompts, Confirm otherwise.
    (tone === 'danger' ? cancelRef : confirmRef).current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tone, onCancel]);

  const confirmClass =
    tone === 'danger'
      ? 'border-terminal-red bg-terminal-red/10 text-terminal-red hover:bg-terminal-red/20'
      : 'border-terminal-green bg-terminal-green/10 text-terminal-green hover:bg-terminal-green/20';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-terminal-border bg-terminal-panel shadow-neon"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-terminal-border p-5">
          <span className={`text-2xl ${tone === 'danger' ? 'text-terminal-red' : 'text-terminal-amber'}`}>
            {tone === 'danger' ? '⚠' : '❔'}
          </span>
          <h2 className="mt-0.5 text-lg font-extrabold text-terminal-green">{title}</h2>
        </div>
        <p className="whitespace-pre-line px-5 py-4 text-sm leading-relaxed text-terminal-dim">{body}</p>
        <div className="flex justify-end gap-2 border-t border-terminal-border p-4">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-terminal-border px-4 py-2 text-sm font-bold uppercase tracking-widest text-terminal-dim transition hover:border-terminal-green hover:text-terminal-green disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg border px-4 py-2 text-sm font-bold uppercase tracking-widest transition disabled:opacity-40 ${confirmClass}`}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
