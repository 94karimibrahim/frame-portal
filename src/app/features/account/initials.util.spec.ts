import { initials } from './initials.util';

describe('initials', () => {
  it('uses the first and last words for multi-word names', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('Karim Tarek Ibrahim')).toBe('KI');
  });

  it('uses the first two letters of a single word', () => {
    expect(initials('admin')).toBe('AD');
  });

  it('returns a placeholder for empty input', () => {
    expect(initials('   ')).toBe('?');
  });
});
