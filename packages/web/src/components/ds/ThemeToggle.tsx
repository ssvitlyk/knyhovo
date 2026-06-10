'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'kn-theme';

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage may be unavailable (private mode); theme still applies for the session */
  }
}

/** Subscribe to `<html data-theme>` changes (set by us or the bootstrap script). */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function getServerSnapshot(): Theme {
  return 'light';
}

/**
 * Knyhovo DS ThemeToggle — the frozen `.kn-theme-toggle` sun/moon switch.
 * Mirrors the reference `components/display/ThemeToggle.jsx`. The active theme is
 * read from the live `<html data-theme>` attribute (set pre-paint by the layout
 * bootstrap) via `useSyncExternalStore`, and persisted to `localStorage`.
 */
export function ThemeToggle({ className = '' }: { readonly className?: string }): React.JSX.Element {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const classes = ['kn-theme-toggle', className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="group" aria-label="Theme">
      <button
        type="button"
        data-active={theme === 'light' ? 'true' : 'false'}
        onClick={() => applyTheme('light')}
        aria-label="Light theme"
      >
        <Sun aria-hidden="true" />
      </button>
      <button
        type="button"
        data-active={theme === 'dark' ? 'true' : 'false'}
        onClick={() => applyTheme('dark')}
        aria-label="Dark theme"
      >
        <Moon aria-hidden="true" />
      </button>
    </div>
  );
}
