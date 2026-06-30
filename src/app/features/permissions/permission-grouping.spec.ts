import { Permission } from '../../core/models';
import { groupByModule } from './permission-grouping';

function perm(code: string, module: string): Permission {
  return {
    id: code,
    code,
    displayName: code,
    description: null,
    module,
    isSystem: true,
    translations: [],
  };
}

describe('groupByModule', () => {
  it('groups by module, sorting modules and codes alphabetically', () => {
    const result = groupByModule([
      perm('users.list', 'users'),
      perm('roles.create', 'roles'),
      perm('users.create', 'users'),
    ]);

    expect(result.map((g) => g.module)).toEqual(['roles', 'users']);
    expect(result[1].items.map((p) => p.code)).toEqual(['users.create', 'users.list']);
  });

  it('returns an empty array for an empty catalogue', () => {
    expect(groupByModule([])).toEqual([]);
  });
});
