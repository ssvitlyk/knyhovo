import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
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
        <div className="page">
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
