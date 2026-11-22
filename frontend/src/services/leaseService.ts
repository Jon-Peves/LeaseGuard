import { ApiError, request } from './api';
import type {
  Activity,
  Invite,
  PhotoMap,
  Property,
  UnitDetails,
} from '../data/demoStore';

export type LandlordState = {
  consented: boolean;
  properties: Property[];
  activity: Activity[];
};

export type TenantState = {
  consented: boolean;
  welcomed: boolean;
  baselineReviewed: boolean;
  movePhotos: PhotoMap;
  unit: Invite | null;
  details: UnitDetails | null;
  pendingInvite: Invite | null;
};

export async function csrfToken(): Promise<string> {
  const { csrfToken: token } = await request<{ csrfToken: string }>(
    '/auth/csrf/',
  );
  if (!token) {
    throw new ApiError('Unable to start a secure session. Please try again.');
  }
  return token;
}

async function send<T>(
  path: string,
  data: object = {},
  method: 'POST' | 'DELETE' = 'POST',
): Promise<T> {
  return request<T>(path, {
    method,
    body: method === 'POST' ? JSON.stringify(data) : undefined,
    headers: { 'X-CSRFToken': await csrfToken() },
  });
}

export const landlordApi = {
  state: () => request<LandlordState>('/landlord/state/'),
  consent: () => send<LandlordState>('/landlord/consent/'),
  addProperty: (input: {
    propertyId: string;
    unitId: string;
    street: string;
    city: string;
    unit: string;
    bedrooms: string;
    bathrooms: string;
    areas: string[];
    email?: string;
  }) => send<LandlordState>('/landlord/properties/', input),
  updateUnit: (
    unitId: string,
    changes: {
      name: string;
      bedrooms: string;
      bathrooms: string;
      areas: string[];
    },
  ) => send<LandlordState>(`/landlord/units/${unitId}/`, changes),
  invite: (unitId: string, email: string) =>
    send<LandlordState>(`/landlord/units/${unitId}/tenant/`, { email }),
  removeTenant: (unitId: string) =>
    send<LandlordState>(`/landlord/units/${unitId}/tenant/`, {}, 'DELETE'),
  saveBaseline: (unitId: string, notes: Record<string, string>) =>
    send<LandlordState>(`/landlord/units/${unitId}/baseline/`, { notes }),
  renameArea: (unitId: string, from: string, to: string) =>
    send<LandlordState>(`/landlord/units/${unitId}/areas/rename/`, {
      from,
      to,
    }),
  scheduleInspection: (unitId: string, inspection: object) =>
    send<LandlordState>(`/landlord/units/${unitId}/inspections/`, inspection),
  confirmTime: (inspectionId: string, slotId: string) =>
    send<LandlordState>(`/landlord/inspections/${inspectionId}/confirm/`, {
      slotId,
    }),
  cancelInspection: (inspectionId: string) =>
    send<LandlordState>(`/landlord/inspections/${inspectionId}/`, {}, 'DELETE'),
  rerunReview: (inspectionId: string) =>
    send<LandlordState>(`/landlord/inspections/${inspectionId}/review/`),
};

export const tenantApi = {
  state: () => request<TenantState>('/tenant/state/'),
  progress: (flags: {
    welcomed?: true;
    consented?: true;
    baselineReviewed?: true;
  }) => send<TenantState>('/tenant/progress/', flags),
  acceptInvite: (unitId: string) =>
    send<TenantState>('/tenant/invite/accept/', { unitId }),
  declineInvite: (unitId: string) =>
    send<TenantState>('/tenant/invite/decline/', { unitId }),
  sendAvailability: (inspectionId: string, slotIds: string[]) =>
    send<TenantState>(`/tenant/inspections/${inspectionId}/availability/`, {
      slotIds,
    }),
  submitInspection: (inspectionId: string, notes: Record<string, string>) =>
    send<TenantState>(`/tenant/inspections/${inspectionId}/submit/`, {
      notes,
    }),
};
