import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { LoginModalProvider } from '@/components/auth/LoginModalProvider';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Knyhovo — пошук книг',
  description: 'Пошук паперових книг та порівняння цін у книгарнях.',
};

// Applies the saved theme before first paint to avoid a flash of the wrong theme.
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('kn-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <html lang="uk" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        {/* One login modal for the whole app (singleton) — mounted here so every
            «Увійти» trigger shares a single overlay/portal/backdrop. The header
            lives outside `.page` (it carries its own `.knh__page` container with
            the same width tokens) but still inside the provider, since it needs
            the login modal context. */}
        <LoginModalProvider>
          <SiteHeader />
          <div className="page">
            {children}
            <SiteFooter />
          </div>
        </LoginModalProvider>
      </body>
    </html>
  );
}
