import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProfilePanel } from '../ProfilePanel';

// Mock the api modules
vi.mock('@/lib/api/profile', () => ({
  updateProfile: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requestMagicLink: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@/lib/navigate', () => ({
  hardNavigate: vi.fn(),
}));

// Mock AlertToast portal
vi.mock('@/components/alerts/AlertToast', () => ({
  AlertToast: ({ children }: { children: React.ReactNode }) => (
    <div role="status">{children}</div>
  ),
}));

import { updateProfile } from '@/lib/api/profile';
import { requestMagicLink, logout } from '@/lib/api/auth';
import { hardNavigate } from '@/lib/navigate';
import type { AuthUserDto } from '@/lib/api/types';

const mockUpdateProfile = vi.mocked(updateProfile);
const mockRequestMagicLink = vi.mocked(requestMagicLink);
const mockLogout = vi.mocked(logout);
const mockHardNavigate = vi.mocked(hardNavigate);

const TEST_EMAIL = 'reader@knyhovo.ua';

const UPDATED_USER: AuthUserDto = {
  id: '1',
  email: TEST_EMAIL,
  createdAt: '2024-01-01T00:00:00.000Z',
  displayName: 'Олена',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('ProfilePanel', () => {
  it('renders readonly email input with the account email', () => {
    render(<ProfilePanel email={TEST_EMAIL} displayName={null} />);
    const emailInput = screen.getByLabelText('Email');
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveValue(TEST_EMAIL);
    expect(emailInput).toHaveAttribute('readOnly');
  });

  it('typing a name and clicking «Зберегти» calls updateProfile with the displayName', async () => {
    mockUpdateProfile.mockResolvedValueOnce(UPDATED_USER);
    render(<ProfilePanel email={TEST_EMAIL} displayName={null} />);

    const nameInput = screen.getByPlaceholderText('Як до вас звертатися');
    fireEvent.change(nameInput, { target: { value: 'Олена' } });

    const saveBtn = screen.getByRole('button', { name: 'Зберегти' });
    fireEvent.click(saveBtn);

    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: 'Олена' }));
  });

  it('shows toast «Профіль оновлено» on successful save', async () => {
    mockUpdateProfile.mockResolvedValueOnce(UPDATED_USER);
    render(<ProfilePanel email={TEST_EMAIL} displayName={null} />);

    const nameInput = screen.getByPlaceholderText('Як до вас звертатися');
    fireEvent.change(nameInput, { target: { value: 'Олена' } });

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Профіль оновлено'),
    );
  });

  it('trims whitespace before sending PATCH («   Sergii   » → «Sergii»)', async () => {
    mockUpdateProfile.mockResolvedValueOnce({ ...UPDATED_USER, displayName: 'Sergii' });
    render(<ProfilePanel email={TEST_EMAIL} displayName={null} />);

    const nameInput = screen.getByPlaceholderText('Як до вас звертатися');
    fireEvent.change(nameInput, { target: { value: '   Sergii   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));

    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: 'Sergii' }));
  });

  it('does NOT PATCH or toast when the name is unchanged after trimming', () => {
    render(<ProfilePanel email={TEST_EMAIL} displayName="Олена" />);

    // Unchanged → Save is disabled from the start.
    const saveBtn = screen.getByRole('button', { name: 'Зберегти' });
    expect(saveBtn).toBeDisabled();

    // Re-typing the same value with surrounding whitespace is still a no-op.
    const nameInput = screen.getByPlaceholderText('Як до вас звертатися');
    fireEvent.change(nameInput, { target: { value: '  Олена  ' } });
    expect(saveBtn).toBeDisabled();

    // Even submitting the form directly (guard path) sends nothing.
    fireEvent.submit(nameInput.closest('form') as HTMLFormElement);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('prevents duplicate save requests while a PATCH is pending', async () => {
    let resolvePatch: (u: AuthUserDto) => void = () => {};
    mockUpdateProfile.mockReturnValueOnce(
      new Promise<AuthUserDto>((resolve) => {
        resolvePatch = resolve;
      }),
    );
    render(<ProfilePanel email={TEST_EMAIL} displayName={null} />);

    const nameInput = screen.getByPlaceholderText('Як до вас звертатися');
    fireEvent.change(nameInput, { target: { value: 'Олена' } });

    const saveBtn = screen.getByRole('button', { name: 'Зберегти' });
    fireEvent.click(saveBtn);
    expect(saveBtn).toBeDisabled(); // in-flight → disabled
    fireEvent.click(saveBtn); // duplicate click is a no-op

    resolvePatch(UPDATED_USER);
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledTimes(1));
  });

  it('prevents duplicate magic-link requests while one is pending', async () => {
    let resolveLink: () => void = () => {};
    mockRequestMagicLink.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveLink = resolve;
      }),
    );
    render(<ProfilePanel email={TEST_EMAIL} displayName={null} />);

    const magicBtn = screen.getByRole('button', { name: 'Надіслати нове посилання для входу' });
    fireEvent.click(magicBtn);
    expect(magicBtn).toBeDisabled();
    fireEvent.click(magicBtn); // duplicate click is a no-op

    resolveLink();
    await waitFor(() => expect(mockRequestMagicLink).toHaveBeenCalledTimes(1));
  });

  it('shows inline error and does NOT call updateProfile when name exceeds 40 chars', async () => {
    render(<ProfilePanel email={TEST_EMAIL} displayName={null} />);

    const nameInput = screen.getByPlaceholderText('Як до вас звертатися');
    // 41 characters
    fireEvent.change(nameInput, { target: { value: 'а'.repeat(41) } });

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/максимум 40 символів/)).toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('clicking «Надіслати нове посилання…» calls requestMagicLink with the email', async () => {
    mockRequestMagicLink.mockResolvedValueOnce(undefined);
    render(<ProfilePanel email={TEST_EMAIL} displayName={null} />);

    const magicBtn = screen.getByRole('button', { name: 'Надіслати нове посилання для входу' });
    fireEvent.click(magicBtn);

    await waitFor(() => expect(mockRequestMagicLink).toHaveBeenCalledWith(TEST_EMAIL));
  });

  it('shows toast «Посилання надіслано» after sending magic link', async () => {
    mockRequestMagicLink.mockResolvedValueOnce(undefined);
    render(<ProfilePanel email={TEST_EMAIL} displayName={null} />);

    const magicBtn = screen.getByRole('button', { name: 'Надіслати нове посилання для входу' });
    fireEvent.click(magicBtn);

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Посилання надіслано'),
    );
  });

  it('clicking «Вийти» calls logout() then hardNavigate(\'/\')', async () => {
    mockLogout.mockResolvedValueOnce(undefined);
    render(<ProfilePanel email={TEST_EMAIL} displayName={null} />);

    const logoutBtn = screen.getByRole('button', { name: /Вийти/ });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockHardNavigate).toHaveBeenCalledWith('/');
    });
  });
});
