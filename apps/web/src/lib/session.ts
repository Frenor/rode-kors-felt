/**
 * Session helpers — access-token lifetime and refresh.
 *
 * Access tokens issued by the API live for 15 minutes. Field users keep the
 * app open for hours, so every REST call and the WebSocket must be able to
 * refresh the access token transparently using the long-lived refresh token.
 *
 * Refresh is single-flight: concurrent callers share one in-flight request.
 * When the refresh token itself is rejected we log the user out loudly
 * (redirect to the code page with an explanation) instead of letting every
 * save fail silently with "prøv igjen".
 */

import { useAuthStore } from '../stores/auth';

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

/** sessionStorage flag read by CodeEntryPage to explain a forced logout. */
export const SESSION_EXPIRED_KEY = 'rkf-session-expired';

/** Refresh proactively when less than this many seconds remain. */
const EXPIRY_SKEW_SECONDS = 60;

let inflightRefresh: Promise<string | null> | null = null;

/** Returns the JWT `exp` claim (seconds since epoch) or null for non-JWT tokens. */
export function decodeTokenExp(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/** True when the token has an `exp` claim that is past or within the skew window. */
export function isTokenExpiringSoon(token: string | null | undefined, skewSeconds = EXPIRY_SKEW_SECONDS): boolean {
  const exp = decodeTokenExp(token);
  if (exp === null) return false;
  return exp - Math.floor(Date.now() / 1000) <= skewSeconds;
}

function markSessionExpired() {
  try {
    sessionStorage.setItem(SESSION_EXPIRED_KEY, '1');
  } catch {
    // storage unavailable — the redirect to the code page still happens
  }
}

/**
 * Exchange the stored refresh token for a new access token.
 *
 * Resolves with the new token, or null when no refresh was possible. A
 * definitive rejection (401/403) clears the session so the UI redirects to the
 * code page; a network failure keeps the session so offline work continues.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        console.warn('[session] Token refresh rejected by server', res.status);
        if (res.status === 401 || res.status === 403) {
          markSessionExpired();
          useAuthStore.getState().logout();
        }
        return null;
      }

      const { accessToken } = (await res.json()) as { accessToken?: string };
      if (!accessToken) return null;
      useAuthStore.setState({ accessToken });
      return accessToken;
    } catch (err) {
      console.warn('[session] Token refresh failed (network)', err);
      return null;
    }
  })().finally(() => {
    inflightRefresh = null;
  });

  return inflightRefresh;
}
