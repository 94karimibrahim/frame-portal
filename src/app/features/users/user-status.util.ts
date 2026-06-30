import { UserStatus } from '../../core/models';
import { BadgeVariant } from '../../shared/ui/badge.component';

/** Maps a {@link UserStatus} to the badge colour intent used wherever a user's status is shown. */
export function userStatusVariant(status: UserStatus): BadgeVariant {
  switch (status) {
    case UserStatus.Active:
      return 'success';
    case UserStatus.Pending:
      return 'warning';
    case UserStatus.Suspended:
      return 'error';
    case UserStatus.Deactivated:
    default:
      return 'neutral';
  }
}
