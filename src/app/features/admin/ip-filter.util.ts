import { IpFilterType } from '../../core/models';
import { BadgeVariant } from '../../shared/ui/badge.component';

/** i18n key for an IP-filter type. */
export function ipFilterTypeLabel(type: IpFilterType): string {
  return type === IpFilterType.Allow ? 'admin.ipFilters.allow' : 'admin.ipFilters.block';
}

/** Badge colour intent for an IP-filter type (allow = positive, block = negative). */
export function ipFilterTypeVariant(type: IpFilterType): BadgeVariant {
  return type === IpFilterType.Allow ? 'success' : 'error';
}
