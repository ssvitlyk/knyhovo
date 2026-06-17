import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertNote } from '../AlertNote';

describe('AlertNote', () => {
  it('kind="err" → role="alert"', () => {
    render(<AlertNote kind="err">Помилка</AlertNote>);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('kind="ok" → role="status"', () => {
    render(<AlertNote kind="ok">Добре</AlertNote>);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('kind="quiet" → role="status"', () => {
    render(<AlertNote kind="quiet">Тихо</AlertNote>);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders children text', () => {
    render(<AlertNote kind="ok">Сповіщення збережено</AlertNote>);
    expect(screen.getByText('Сповіщення збережено')).toBeTruthy();
  });

  it('renders action when provided', () => {
    render(
      <AlertNote kind="err" action={<button type="button">Спробувати ще раз</button>}>
        Помилка
      </AlertNote>,
    );
    expect(screen.getByRole('button', { name: 'Спробувати ще раз' })).toBeTruthy();
  });

  it('does not render action area when action is not provided', () => {
    const { container } = render(<AlertNote kind="ok">Тест</AlertNote>);
    expect(container.querySelector('.al-note__action')).toBeNull();
  });

  it('err → has class al-note--err', () => {
    const { container } = render(<AlertNote kind="err">Помилка</AlertNote>);
    expect(container.querySelector('.al-note--err')).toBeTruthy();
  });

  it('ok → has class al-note--ok', () => {
    const { container } = render(<AlertNote kind="ok">OK</AlertNote>);
    expect(container.querySelector('.al-note--ok')).toBeTruthy();
  });

  it('quiet → has class al-note--quiet', () => {
    const { container } = render(<AlertNote kind="quiet">Info</AlertNote>);
    expect(container.querySelector('.al-note--quiet')).toBeTruthy();
  });
});
