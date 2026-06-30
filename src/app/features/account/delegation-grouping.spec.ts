import { groupCodesByModule } from './delegation-grouping';

describe('groupCodesByModule', () => {
  it('groups dotted codes by module, sorting modules and codes', () => {
    const result = groupCodesByModule(['users.list', 'roles.assign', 'users.create']);
    expect(result.map((g) => g.module)).toEqual(['roles', 'users']);
    expect(result[1].codes).toEqual(['users.create', 'users.list']);
  });

  it('treats a code with no dot as its own module', () => {
    expect(groupCodesByModule(['admin'])).toEqual([{ module: 'admin', codes: ['admin'] }]);
  });

  it('returns an empty array for no codes', () => {
    expect(groupCodesByModule([])).toEqual([]);
  });
});
