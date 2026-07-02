import { TokenStore } from './token-store.service';

const REFRESH_KEY = 'frame.rt';

/**
 * `TokenStore` has no Angular dependencies, so it's exercised directly (no TestBed). These tests pin the
 * template's token-storage contract: the access token is never persisted, the refresh token is mirrored to
 * `sessionStorage` (and recovered on construction), and `clear()` wipes both.
 */
describe('TokenStore', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

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
});
