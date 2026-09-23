import { beforeEach, describe, expect, it } from 'vitest';
import { roleAwareAuthStorage, useAuthStore } from '../stores/auth';

const initialState = {
  accessToken: null,
  refreshToken: null,
  role: null,
  eventId: null,
  eventName: null,
  teams: [],
  isAuthenticated: false,
};

beforeEach(() => {
  useAuthStore.setState(initialState);
  localStorage.clear();
  sessionStorage.clear();
});

describe('auth store — login()', () => {
  it('sets all fields and isAuthenticated: true on a full login', () => {
    useAuthStore.getState().login({
      accessToken: 'access-abc',
      refreshToken: 'refresh-xyz',
      role: 'first_aider',
      eventId: 'evt-1',
      eventName: 'Test Event',
      teams: [{ id: 't1', name: 'Team Alpha' }],
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('access-abc');
    expect(state.refreshToken).toBe('refresh-xyz');
    expect(state.role).toBe('first_aider');
    expect(state.eventId).toBe('evt-1');
    expect(state.eventName).toBe('Test Event');
    expect(state.teams).toEqual([{ id: 't1', name: 'Team Alpha' }]);
    expect(state.isAuthenticated).toBe(true);
  });

  it('defaults eventId to null when not provided', () => {
    useAuthStore.getState().login({
      accessToken: 'tok',
      refreshToken: 'ref',
      role: 'first_aider',
    });

    expect(useAuthStore.getState().eventId).toBeNull();
  });

  it('defaults eventName to null when not provided', () => {
    useAuthStore.getState().login({
      accessToken: 'tok',
      refreshToken: 'ref',
      role: 'first_aider',
    });

    expect(useAuthStore.getState().eventName).toBeNull();
  });

  it('defaults teams to [] when not provided', () => {
    useAuthStore.getState().login({
      accessToken: 'tok',
      refreshToken: 'ref',
      role: 'first_aider',
    });

    expect(useAuthStore.getState().teams).toEqual([]);
  });
});

describe('auth store — logout()', () => {
  it('resets all fields and sets isAuthenticated: false', () => {
    useAuthStore.getState().login({
      accessToken: 'access-abc',
      refreshToken: 'refresh-xyz',
      role: 'first_aider',
      eventId: 'evt-1',
      eventName: 'Test Event',
      teams: [{ id: 't1', name: 'Team Alpha' }],
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.role).toBeNull();
    expect(state.eventId).toBeNull();
    expect(state.eventName).toBeNull();
    expect(state.teams).toEqual([]);
    expect(state.isAuthenticated).toBe(false);
  });
});

describe('auth store — storage policy', () => {
  it('keeps a field (code-based) session in localStorage so it survives app restarts', () => {
    useAuthStore.getState().login({
      accessToken: 'persisted-token',
      refreshToken: 'ref',
      role: 'first_aider',
    });

    const raw = localStorage.getItem('rkf-auth');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).state.accessToken).toBe('persisted-token');
    expect(sessionStorage.getItem('rkf-auth')).toBeNull();
  });

  it('keeps a sick bay session in localStorage as well', () => {
    useAuthStore.getState().login({
      accessToken: 'sickbay-token',
      refreshToken: 'ref',
      role: 'sickbay',
    });

    expect(localStorage.getItem('rkf-auth')).not.toBeNull();
    expect(sessionStorage.getItem('rkf-auth')).toBeNull();
  });

  it('keeps coordinator sessions in sessionStorage only', () => {
    useAuthStore.getState().login({
      accessToken: 'coordinator-token',
      refreshToken: 'ref',
      role: 'coordinator',
    });

    const raw = sessionStorage.getItem('rkf-auth');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).state.accessToken).toBe('coordinator-token');
    expect(localStorage.getItem('rkf-auth')).toBeNull();
  });

  it('clears the durable copy on logout', () => {
    useAuthStore.getState().login({
      accessToken: 'persisted-token',
      refreshToken: 'ref',
      role: 'first_aider',
    });
    expect(localStorage.getItem('rkf-auth')).not.toBeNull();

    useAuthStore.getState().logout();

    expect(localStorage.getItem('rkf-auth')).toBeNull();
    const session = sessionStorage.getItem('rkf-auth');
    expect(session === null || JSON.parse(session).state.accessToken === null).toBe(true);
  });

  it('prefers the session copy over an older durable copy when hydrating', () => {
    localStorage.setItem('rkf-auth', JSON.stringify({ state: { role: 'first_aider', accessToken: 'old' }, version: 0 }));
    sessionStorage.setItem('rkf-auth', JSON.stringify({ state: { role: 'coordinator', accessToken: 'new' }, version: 0 }));

    const raw = roleAwareAuthStorage.getItem('rkf-auth') as string;
    expect(JSON.parse(raw).state.accessToken).toBe('new');
  });
});
