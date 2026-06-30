import { IpFilterType } from './enums';

// ----- Tenants -----

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionTier: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionTier: string;
  defaultCulture: string;
  features: string[];
  createdAt: string;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  subscriptionTier: string;
  features?: string[] | null;
  defaultCulture?: string | null;
}

export interface UpdateTenantRequest {
  name: string;
  subscriptionTier: string;
  defaultCulture?: string | null;
}

// ----- IP filters -----

export interface IpFilter {
  id: string;
  ipAddressOrCidr: string;
  type: IpFilterType;
  description?: string | null;
  createdAt: string;
}

export interface CreateIpFilterRequest {
  ipAddressOrCidr: string;
  type: IpFilterType;
  description?: string | null;
}

// ----- Password policy -----

export interface PasswordPolicy {
  minLength: number;
  requireDigit: boolean;
  requireSpecial: boolean;
  requireUpper: boolean;
  requireLower: boolean;
  maxAgeDays: number;
  historyCount: number;
  lockoutThreshold: number;
  lockoutMinutes: number;
}

// ----- Delegations -----

export interface Delegation {
  id: string;
  delegatorId: string;
  delegatedToId: string;
  permissionSet: string[];
  startsAt: string;
  expiresAt: string;
  isRevoked: boolean;
  createdAt: string;
}

export interface CreateDelegationRequest {
  delegatedToId: string;
  permissionSet: string[];
  startsAt: string;
  expiresAt: string;
}

// ----- Preferences -----

export interface Preferences {
  language: string;
  theme: string;
  timezone: string;
  notifications: boolean;
  dateFormat: string;
  timeFormat: string;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  marketingEmailsEnabled: boolean;
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  profilePublic: boolean;
  requirePasswordOnSensitiveActions: boolean;
  autoLogoutMinutes: number;
  maxActiveSessions: number;
}

/** PUT body — language/theme/timezone/notifications required, the rest optional (merge semantics). */
export interface UpdatePreferencesRequest {
  language: string;
  theme: string;
  timezone: string;
  notifications: boolean;
  dateFormat?: string | null;
  timeFormat?: string | null;
  emailNotificationsEnabled?: boolean | null;
  smsNotificationsEnabled?: boolean | null;
  pushNotificationsEnabled?: boolean | null;
  inAppNotificationsEnabled?: boolean | null;
  marketingEmailsEnabled?: boolean | null;
  showOnlineStatus?: boolean | null;
  showLastSeen?: boolean | null;
  profilePublic?: boolean | null;
  requirePasswordOnSensitiveActions?: boolean | null;
  autoLogoutMinutes?: number | null;
  maxActiveSessions?: number | null;
}

// ----- Localization -----

export interface SupportedCultures {
  cultures: string[];
  default: string;
}
