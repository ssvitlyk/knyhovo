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
        {/* DS webfonts (Lora + Inter). Loaded via <link>, not CSS @import:
            the bundler drops external @import url() rules from compiled CSS,
            which silently left the whole app on fallback system fonts. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Inter:wght@400;500;600;700&display=swap"
        />
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
