import type { ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';

export interface AlertNoteProps {
  /** Visual and semantic variant: 'ok' = success, 'quiet' = informational, 'err' = error. */
  kind: 'ok' | 'quiet' | 'err';
  /** The note body text or elements. */
  children: ReactNode;
  /** Optional action (e.g. a retry Button) rendered after the body. */
  action?: ReactNode;
}

/** Icon size used for all note variants. */
const ICON_SIZE = 18;

/**
 * AlertNote — a subtle inline confirmation or error note. Never red,
 * never celebratory. Uses `role="alert"` for errors (live region with
 * assertive politeness) and `role="status"` for ok/quiet (polite).
 */
export function AlertNote({ kind, children, action }: AlertNoteProps): React.JSX.Element {
  let icon: React.JSX.Element;
  switch (kind) {
    case 'ok':
      icon = <CheckCircle2 size={ICON_SIZE} aria-hidden />;
      break;
    case 'quiet':
      icon = <Info size={ICON_SIZE} aria-hidden />;
      break;
    case 'err':
      icon = <TriangleAlert size={ICON_SIZE} aria-hidden />;
      break;
  }

  return (
    <div className={`al-note al-note--${kind}`} role={kind === 'err' ? 'alert' : 'status'}>
      <span className="al-note__icon">{icon}</span>
      <span className="al-note__body">{children}</span>
      {action != null && <span className="al-note__action">{action}</span>}
    </div>
  );
}
