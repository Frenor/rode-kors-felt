/**
 * AccessCodesPanel — event set-up (gap B5 / item 8.31): code creation and revoke.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccessCodesPanel } from '../pages/Coordinator/AccessCodesPanel';
import type { AccessCode } from '../lib/types';

vi.mock('qrcode', () => ({
  toCanvas: vi.fn().mockResolvedValue(undefined),
}));

const CODES: AccessCode[] = [
  { id: 'code-1', role: 'first_aider', code: '123456', expiresAt: '2026-09-24T12:00:00Z', revokedAt: null },
];

describe('AccessCodesPanel', () => {
  it('creates a code and shows it once, in full, with a copy button and a QR canvas', async () => {
    const newCode: AccessCode = { id: 'code-2', role: 'first_aider', code: '654321', expiresAt: '2026-09-25T00:00:00Z', revokedAt: null };
    const onCreateCode = vi.fn().mockResolvedValue(newCode);
    render(<AccessCodesPanel codes={[]} onCreateCode={onCreateCode} onRevokeCode={vi.fn()} />);

    fireEvent.click(screen.getByTestId('event-setup-code-create'));
    await waitFor(() => expect(onCreateCode).toHaveBeenCalledWith({ role: 'first_aider', hours: 24 }));
    expect(await screen.findByTestId('event-setup-code-value')).toHaveTextContent('654321');
    expect(screen.getByTestId('event-setup-code-qr')).toBeInTheDocument();
  });

  it('masks existing codes in the list and never shows the plaintext again', () => {
    render(<AccessCodesPanel codes={CODES} onCreateCode={vi.fn()} onRevokeCode={vi.fn()} />);
    expect(screen.queryByText('123456')).not.toBeInTheDocument();
    expect(screen.getByText('••••••')).toBeInTheDocument();
  });

  it('revokes a code', async () => {
    const onRevokeCode = vi.fn().mockResolvedValue(undefined);
    render(<AccessCodesPanel codes={CODES} onCreateCode={vi.fn()} onRevokeCode={onRevokeCode} />);
    fireEvent.click(screen.getByTestId('event-setup-code-revoke-code-1'));
    await waitFor(() => expect(onRevokeCode).toHaveBeenCalledWith('code-1'));
  });

  it('shows a visible error line when creation fails', async () => {
    const onCreateCode = vi.fn().mockRejectedValue(new Error('Nettverksfeil'));
    render(<AccessCodesPanel codes={[]} onCreateCode={onCreateCode} onRevokeCode={vi.fn()} />);
    fireEvent.click(screen.getByTestId('event-setup-code-create'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nettverksfeil');
  });

  it('does not offer "Trekk tilbake" for an already-revoked code', () => {
    render(
      <AccessCodesPanel
        codes={[{ ...CODES[0]!, revokedAt: '2026-09-23T12:00:00Z' }]}
        onCreateCode={vi.fn()}
        onRevokeCode={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('event-setup-code-revoke-code-1')).not.toBeInTheDocument();
    expect(screen.getByText('Trukket tilbake')).toBeInTheDocument();
  });
});
