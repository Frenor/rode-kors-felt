import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../stores/auth';

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

describe('auth store — localStorage persistence', () => {
  it('writes the access token to localStorage under the rkf-auth key after login', () => {
    useAuthStore.getState().login({
      accessToken: 'persisted-token',
      refreshToken: 'ref',
      role: 'first_aider',
    });

    const raw = localStorage.getItem('rkf-auth');
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!);
    // Zustand persist wraps the value under a `state` key
    expect(parsed.state.accessToken).toBe('persisted-token');
  });
});
