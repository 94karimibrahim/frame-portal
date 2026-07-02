import { TokenStore } from './token-store.service';

const REFRESH_KEY = 'frame.rt';
const HINT_KEY = 'frame.session';

/**
 * `TokenStore` has no Angular dependencies, so it's exercised directly (no TestBed). These tests pin the
 * template's token-storage contract: the access token is never persisted; in body mode the refresh token
 * is mirrored to `sessionStorage` (and recovered on construction); in cookie mode (empty refresh token)
 * only a non-sensitive session hint is left in `localStorage`; and `clear()` wipes everything.
 */
describe('TokenStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('never persists the access token', () => {
    const store = new TokenStore();
    store.setTokens('access', 'refresh');

    expect(store.getAccessToken()).toBe('access');
    // The access token must not be discoverable anywhere in sessionStorage.
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)!;
      expect(sessionStorage.getItem(key)).not.toBe('access');
    }
  });

  it('mirrors the refresh token to sessionStorage', () => {
    const store = new TokenStore();
    store.setTokens('access', 'refresh');

    expect(store.getRefreshToken()).toBe('refresh');
    expect(sessionStorage.getItem(REFRESH_KEY)).toBe('refresh');
    expect(store.hasRefreshToken()).toBe(true);
  });

  it('recovers a refresh token left by a prior page load', () => {
    sessionStorage.setItem(REFRESH_KEY, 'survivor');

    const store = new TokenStore();

    expect(store.getRefreshToken()).toBe('survivor');
    expect(store.hasRefreshToken()).toBe(true);
  });

  it('replaces only the access token on setAccessToken (refresh untouched)', () => {
    const store = new TokenStore();
    store.setTokens('access', 'refresh');

    store.setAccessToken('access-2');

    expect(store.getAccessToken()).toBe('access-2');
    expect(store.getRefreshToken()).toBe('refresh');
    expect(sessionStorage.getItem(REFRESH_KEY)).toBe('refresh');
  });

  it('clear() wipes memory and the session mirror', () => {
    const store = new TokenStore();
    store.setTokens('access', 'refresh');

    store.clear();

    expect(store.getAccessToken()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
    expect(store.hasRefreshToken()).toBe(false);
    expect(sessionStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('cookie mode (empty refresh token) stores no token, only the session hint', () => {
    const store = new TokenStore();
    store.setTokens('access', '');

    expect(store.getAccessToken()).toBe('access');
    expect(store.getRefreshToken()).toBeNull();
    expect(store.hasRefreshToken()).toBe(false);
    expect(store.hasSession()).toBe(true);
    expect(sessionStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(localStorage.getItem(HINT_KEY)).toBe('1');
  });

  it('a cookie-mode rotation clears a leftover body-mode mirror', () => {
    const store = new TokenStore();
    store.setTokens('access', 'legacy-refresh');

    store.setTokens('access-2', '');

    expect(sessionStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
    expect(store.hasSession()).toBe(true);
  });

  it('hasSession() reports the hint left by a prior cookie-mode login', () => {
    localStorage.setItem(HINT_KEY, '1');

    const store = new TokenStore();

    expect(store.hasRefreshToken()).toBe(false);
    expect(store.hasSession()).toBe(true);
  });

  it('clear() removes the session hint too', () => {
    const store = new TokenStore();
    store.setTokens('access', '');

    store.clear();

    expect(store.hasSession()).toBe(false);
    expect(localStorage.getItem(HINT_KEY)).toBeNull();
  });
});
