import { describe, it, expect } from 'vitest';
import { toAuthUserDto } from '../mapper.js';

describe('toAuthUserDto', () => {
  it('maps fields correctly', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const user = { id: 'user-1', email: 'test@example.com', createdAt: date };
    const dto = toAuthUserDto(user);
    expect(dto).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('converts createdAt to ISO string', () => {
    const date = new Date('2024-06-15T12:30:00.000Z');
    const dto = toAuthUserDto({ id: 'x', email: 'a@b.com', createdAt: date });
    expect(dto.createdAt).toBe('2024-06-15T12:30:00.000Z');
  });
});
