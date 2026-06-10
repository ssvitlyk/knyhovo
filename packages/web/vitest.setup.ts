import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// `globals` is disabled, so Testing Library's automatic per-test cleanup is not
// registered — do it explicitly to unmount between tests.
afterEach(() => {
  cleanup();
});
