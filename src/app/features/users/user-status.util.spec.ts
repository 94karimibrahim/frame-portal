import { UserStatus } from '../../core/models';
import { userStatusVariant } from './user-status.util';

describe('userStatusVariant', () => {
  it('maps each status to its badge intent', () => {
    expect(userStatusVariant(UserStatus.Active)).toBe('success');
    expect(userStatusVariant(UserStatus.Pending)).toBe('warning');
    expect(userStatusVariant(UserStatus.Suspended)).toBe('error');
    expect(userStatusVariant(UserStatus.Deactivated)).toBe('neutral');
  });
});
