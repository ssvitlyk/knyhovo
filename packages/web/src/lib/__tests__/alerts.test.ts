import { describe, expect, it } from 'vitest';
import { ALERT_MODE_COPY } from '../alerts';
import type { AlertMode } from '../api/types';

describe('ALERT_MODE_COPY', () => {
  it('has entries for all three modes', () => {
    const modes: readonly AlertMode[] = ['any-drop', 'good-price', 'my-price'];
    for (const mode of modes) {
      expect(ALERT_MODE_COPY[mode]).toBeDefined();
    }
  });

  it('any-drop → «Будь-яке зниження» / «Щойно ціна впаде»', () => {
    expect(ALERT_MODE_COPY['any-drop']).toEqual({
      label: 'Будь-яке зниження',
      description: 'Щойно ціна впаде',
    });
  });

  it('good-price → «Вигідна ціна» with no static description (proof is data-driven)', () => {
    expect(ALERT_MODE_COPY['good-price'].label).toBe('Вигідна ціна');
    expect(ALERT_MODE_COPY['good-price'].description).toBeNull();
  });

  it('my-price → «Моя ціна» with no static description', () => {
    expect(ALERT_MODE_COPY['my-price'].label).toBe('Моя ціна');
    expect(ALERT_MODE_COPY['my-price'].description).toBeNull();
  });
});
