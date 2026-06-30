import { ApiKeyStatus, DeviceType, SessionType, SocialProvider } from './enums';

// ----- Two-factor -----

export interface TwoFactorStatus {
  enabled: boolean;
  setupPending: boolean;
  remainingBackupCodes: number;
}

export interface TwoFactorSetup {
  sharedKey: string;
  authenticatorUri: string;
}

export interface BackupCodes {
  codes: string[];
}

// ----- Sessions -----

export interface Session {
  id: string;
  ipAddress: string;
  deviceInfo?: string | null;
  sessionType: SessionType;
  deviceType: DeviceType;
  deviceName?: string | null;
  operatingSystem?: string | null;
  browser?: string | null;
  location?: string | null;
  countryCode?: string | null;
  lastActivityAt?: string | null;
  expiresAt: string;
  isRevoked: boolean;
  revokedAt?: string | null;
  revokedReason?: string | null;
}

// ----- Devices -----

export interface Device {
  id: string;
  deviceId: string;
  deviceType: DeviceType;
  name: string;
  isTrusted: boolean;
  operatingSystem?: string | null;
  browser?: string | null;
  userAgent?: string | null;
  lastUsedAt?: string | null;
  trustedAt?: string | null;
  trustedUntil?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  lastSeenIp?: string | null;
  lastSeenLocation?: string | null;
  loginCount: number;
}

// ----- API keys -----

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  ipBindings: string[];
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  status: ApiKeyStatus;
}

/** Reveal-once secret returned by create/rotate. */
export interface ApiKeyCreated {
  id: string;
  apiKey: string;
  prefix: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expiresAt?: string | null;
  ipBindings?: string[] | null;
}

// ----- Social accounts -----

export interface SocialAccount {
  id: string;
  provider: SocialProvider;
  providerAccountId: string;
  displayName?: string | null;
  email?: string | null;
  pictureUrl?: string | null;
  scope?: string | null;
  tokenExpiresAt?: string | null;
  isActive: boolean;
  lastUsedAt?: string | null;
}

export interface SocialLoginRequest {
  provider: SocialProvider;
  code: string;
  redirectUri?: string | null;
}

export interface LinkSocialAccountRequest {
  provider: SocialProvider;
  providerAccountId: string;
  displayName?: string | null;
  email?: string | null;
  pictureUrl?: string | null;
}
