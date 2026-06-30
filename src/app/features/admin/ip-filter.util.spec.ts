import { IpFilterType } from '../../core/models';
import { ipFilterTypeLabel, ipFilterTypeVariant } from './ip-filter.util';

describe('ip-filter type helpers', () => {
  it('labels each type', () => {
    expect(ipFilterTypeLabel(IpFilterType.Allow)).toBe('admin.ipFilters.allow');
    expect(ipFilterTypeLabel(IpFilterType.Block)).toBe('admin.ipFilters.block');
  });

  it('maps allow to a positive and block to a negative variant', () => {
    expect(ipFilterTypeVariant(IpFilterType.Allow)).toBe('success');
    expect(ipFilterTypeVariant(IpFilterType.Block)).toBe('error');
  });
});
