import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoginForm } from '../LoginForm';
import { requestMagicLink } from '@/lib/api/auth';

vi.mock('@/lib/api/auth', () => ({
  requestMagicLink: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number | null;
    constructor(msg: string, status: number | null) {
      super(msg);
      this.name = 'AuthError';
      this.status = status;
    }
  },
}));

const mockedRequest = vi.mocked(requestMagicLink);

beforeEach(() => {
  mockedRequest.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

function emailInput(): HTMLInputElement {
  return screen.getByLabelText('Email') as HTMLInputElement;
}
function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Надіслати посилання/ }) as HTMLButtonElement;
}

describe('LoginForm', () => {
  it('renders the idle login panel', () => {
    render(<LoginForm />);
    expect(screen.getByText('Увійти в Knyhovo')).toBeInTheDocument();
    expect(screen.getByText(/Без паролів/)).toBeInTheDocument();
  });

  it('disables submit until the email is valid', () => {
    render(<LoginForm />);
    expect(submitButton()).toBeDisabled();
    fireEvent.change(emailInput(), { target: { value: 'not-an-email' } });
    expect(submitButton()).toBeDisabled();
    fireEvent.change(emailInput(), { target: { value: 'reader@example.com' } });
    expect(submitButton()).toBeEnabled();
  });

  it('submits → calls requestMagicLink with returnTo and shows the success screen', async () => {
    mockedRequest.mockResolvedValue(undefined);
    render(<LoginForm returnTo="/wishlist" />);

    fireEvent.change(emailInput(), { target: { value: 'reader@example.com' } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(screen.getByText('Перевірте пошту')).toBeInTheDocument());
    expect(mockedRequest).toHaveBeenCalledWith('reader@example.com', '/wishlist');
    expect(screen.getByText('reader@example.com')).toBeInTheDocument();
  });

  it('shows the calm error note when the request fails', async () => {
    mockedRequest.mockRejectedValue(new Error('boom'));
    render(<LoginForm />);

    fireEvent.change(emailInput(), { target: { value: 'reader@example.com' } });
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(screen.getByText(/Не вдалося надіслати посилання/)).toBeInTheDocument(),
    );
  });

  it('can change email from the success screen back to the form', async () => {
    mockedRequest.mockResolvedValue(undefined);
    render(<LoginForm />);

    fireEvent.change(emailInput(), { target: { value: 'reader@example.com' } });
    fireEvent.click(submitButton());
    await waitFor(() => expect(screen.getByText('Перевірте пошту')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Змінити email'));
    expect(screen.getByText('Увійти в Knyhovo')).toBeInTheDocument();
  });
});
