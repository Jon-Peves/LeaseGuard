import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ResetDelivery } from '../services/authService';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetEmailSent: { email: string; delivery: ResetDelivery };
  InviteEmail: undefined;
  RegisterInvite: undefined;
};

export type LandlordStackParamList = {
  Notifications: undefined;
  Dashboard: undefined;
  AddProperty: undefined;
  ScheduleInspection: { propertyId: string; unitId: string } | undefined;
  ConfirmInspectionTime: { propertyId: string; unitId: string };
  AIInspectionReview: undefined;
  InspectionResults: { propertyId: string; unitId: string };
  EditUnit: { propertyId: string; unitId: string };
  MoveInTour: { propertyId: string; unitId: string };
  BaselineCapture: {
    propertyId: string;
    unitId: string;
    step: number;
    retake?: boolean;
  };
  ReviewBaseline: { propertyId: string; unitId: string };
};

export type LandlordConsentStackParamList = {
  Consent: undefined;
  ConsentPolicy: undefined;
};

export type LandlordSettingsStackParamList = {
  SettingsHome: undefined;
  PrivacySecurity: undefined;
  PrivacyPolicy: undefined;
  Profile: undefined;
};

export type LandlordTabParamList = {
  HomeStack: NavigatorScreenParams<LandlordStackParamList> | undefined;
  History: undefined;
  Settings: NavigatorScreenParams<LandlordSettingsStackParamList> | undefined;
};
export type TenantTabParamList = {
  Home: undefined;
  Inspections: undefined;
  Settings: undefined;
};

export type TenantStackParamList = {
  History: undefined;
  Notifications: undefined;
  PrivacySecurity: undefined;
  PrivacyPolicy: undefined;
  Profile: undefined;
  TenantTabs:
    | import('@react-navigation/native').NavigatorScreenParams<TenantTabParamList>
    | undefined;
  GuidedInspection: undefined;
  ReportMaintenance: undefined;
  InspectionAvailability: undefined;
  MaintenanceDetail: {
    requestId: import('../types/maintenance').MaintenanceRequestId;
  };
  ReviewInspectionPhoto: { stepIndex: number };
  InspectionSubmitted: undefined;
  TenantBaseline: undefined;
  TenantMovePhotos: { step: number };
  TenantPickTime: undefined;
  TenantInspectionCapture: { step: number; retake?: boolean };
  TenantInspectionPhoto: { step: number; retake?: boolean };
  TenantInspectionReview: undefined;
  TenantInspectionDone: undefined;
};

export type TenantGateStackParamList = {
  TenantInvite: undefined;
  TenantWelcome: undefined;
  TenantConsent: undefined;
  TenantConsentPolicy: undefined;
};
