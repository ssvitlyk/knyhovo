import type { ReactNode } from 'react';
import { SettingsNav } from '@/components/settings/SettingsNav';

/**
 * Settings shell layout — renders the two-column grid (sidebar + content).
 * Header/footer come from the root layout.
 */
export default function SettingsLayout({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="np-container">
      <main className="np-main">
        <div className="np-layout">
          <SettingsNav />
          {children}
        </div>
      </main>
    </div>
  );
}
