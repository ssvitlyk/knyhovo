# TypeScript Rules

- `strict: true` обов'язковий в усіх `tsconfig.json`
- `any` заборонений; виняток вимагає `// eslint-disable-next-line @typescript-eslint/no-explicit-any` з поясненням
- ESLint з `@typescript-eslint` — порушення є блокером CI
- `type` для union/intersection; `interface` для об'єктів, що успадковуються
- Shared типи живуть у `packages/shared`, не дублюються між пакетами
