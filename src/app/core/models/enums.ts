/**
 * Wire enums — integer values mirroring the backend `Frame.Domain.Enums.*` exactly. The API serializes
 * enums as integers, so these MUST stay in numeric sync with the C# definitions (verified against the
 * Domain layer). Each enum is paired with a label map for display; labels are i18n keys, not final text.
 */

export enum Gender {
  Male = 0,
  Female = 1,
  Other = 2,
  Unspecified = 3,
}

export enum UserStatus {
  Pending = 0,
  Active = 1,
  Suspended = 2,
  Deactivated = 3,
}

export enum SessionType {
  PasswordLogin = 0,
  TwoFactor = 1,
  SocialLogin = 2,
  RememberMe = 3,
  TrustedDevice = 4,
}

export enum DeviceType {
  Browser = 0,
  Mobile = 1,
  Desktop = 2,
  Tablet = 3,
  Api = 4,
}

export enum SocialProvider {
  Google = 0,
  Microsoft = 1,
  GitHub = 2,
  Facebook = 3,
  Apple = 4,
}

export enum IpFilterType {
  Allow = 0,
  Block = 1,
}

export enum ApiKeyStatus {
  Active = 0,
  Expired = 1,
  Revoked = 2,
}

/** i18n keys for each enum member (resolved through Transloco at render time). */
export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  [UserStatus.Pending]: 'enums.userStatus.pending',
  [UserStatus.Active]: 'enums.userStatus.active',
  [UserStatus.Suspended]: 'enums.userStatus.suspended',
  [UserStatus.Deactivated]: 'enums.userStatus.deactivated',
};

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  [SessionType.PasswordLogin]: 'enums.sessionType.passwordLogin',
  [SessionType.TwoFactor]: 'enums.sessionType.twoFactor',
  [SessionType.SocialLogin]: 'enums.sessionType.socialLogin',
  [SessionType.RememberMe]: 'enums.sessionType.rememberMe',
  [SessionType.TrustedDevice]: 'enums.sessionType.trustedDevice',
};

export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  [DeviceType.Browser]: 'enums.deviceType.browser',
  [DeviceType.Mobile]: 'enums.deviceType.mobile',
  [DeviceType.Desktop]: 'enums.deviceType.desktop',
  [DeviceType.Tablet]: 'enums.deviceType.tablet',
  [DeviceType.Api]: 'enums.deviceType.api',
};

export const SOCIAL_PROVIDER_LABEL: Record<SocialProvider, string> = {
  [SocialProvider.Google]: 'Google',
  [SocialProvider.Microsoft]: 'Microsoft',
  [SocialProvider.GitHub]: 'GitHub',
  [SocialProvider.Facebook]: 'Facebook',
  [SocialProvider.Apple]: 'Apple',
};

export const API_KEY_STATUS_LABEL: Record<ApiKeyStatus, string> = {
  [ApiKeyStatus.Active]: 'enums.apiKeyStatus.active',
  [ApiKeyStatus.Expired]: 'enums.apiKeyStatus.expired',
  [ApiKeyStatus.Revoked]: 'enums.apiKeyStatus.revoked',
};

export const GENDER_LABEL: Record<Gender, string> = {
  [Gender.Male]: 'enums.gender.male',
  [Gender.Female]: 'enums.gender.female',
  [Gender.Other]: 'enums.gender.other',
  [Gender.Unspecified]: 'enums.gender.unspecified',
};
