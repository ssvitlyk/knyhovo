import next from 'eslint-config-next';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'design-import/**', 'dist/**'] },
  ...next,
  {
    rules: {
      // Brand logo/mascot lockups are theme-swapped via CSS and rendered as plain
      // <img> on purpose (no layout-shift concern; not content imagery).
      '@next/next/no-img-element': 'off',
    },
  },
];

export default config;
