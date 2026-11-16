// In-memory store shared by the landlord and tenant demo flows. It lives for
// as long as the app is open, so a landlord's invite can be accepted by a
// tenant who signs up afterwards. Replaced by the Django API later.

export type TenantLink = {
  email: string;
  name?: string;
  status: 'pending' | 'joined' | 'declined';
  invitedOn: string;
  joinedOn?: string;
  declinedOn?: string;
};

export type PhotoMap = Record<string, string>;

export type Unit = {
  id: string;
  name: string;
  bedrooms: string;
  bathrooms: string;
  tenant?: TenantLink;
  areas: string[];
  baselinePhotos?: PhotoMap;
  baselineRecordedOn?: string;
};

export type Property = {
  id: string;
  street: string;
  city: string;
  units: Unit[];
};

export type Activity = {
  id: string;
  title: string;
  detail: string;
};

export type LandlordSnapshot = {
  consented: boolean;
  properties: Property[];
  activity: Activity[];
};

export type Invite = {
  email: string;
  landlordId: string;
  landlordName: string;
  propertyId: string;
  unitId: string;
  street: string;
  city: string;
  unit: string;
  bedrooms: string;
  bathrooms: string;
  areaCount: number;
};

export type TenantSnapshot = {
  consented: boolean;
  welcomed: boolean;
  baselineReviewed?: boolean;
  movePhotos?: PhotoMap;
};

export type UnitDetails = {
  areas: string[];
  baselinePhotos: PhotoMap;
  baselineRecordedOn?: string;
  landlordName: string;
};

export const sampleInvite: Invite = {
  email: 'alyssa.patel@example.com',
  landlordId: 'sample-landlord',
  landlordName: 'Marcus Reed',
  propertyId: 'sample-property',
  unitId: 'sample-unit',
  street: '18 Cedar Ave',
  city: 'Farmingdale, NY',
  unit: '1A',
  bedrooms: '1',
  bathrooms: '1',
  areaCount: 4,
};

const landlords = new Map<string, LandlordSnapshot>();
const tenants = new Map<string, TenantSnapshot>();
const acceptedInvites = new Map<string, Invite>();
const unlinkedTenants = new Set<string>();
let invites: Invite[] = [];
let nextId = 1;

const key = (email: string) => email.trim().toLowerCase();

export function makeId(prefix: string) {
  return `${prefix}-${nextId++}`;
}

export function shortDate(date = new Date()) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function nameFromEmail(email: string) {
  const local = email.split('@')[0] ?? '';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export function getLandlord(id: string): LandlordSnapshot | undefined {
  return landlords.get(id);
}

export function saveLandlord(id: string, snapshot: LandlordSnapshot) {
  landlords.set(id, snapshot);
}

export function getTenant(id: string): TenantSnapshot {
  return tenants.get(id) ?? { consented: false, welcomed: true };
}

export const SAMPLE_AREAS = [
  'Living room wall',
  'Kitchen sink',
  'Bathroom ceiling',
  'Bedroom floor',
];

export function unitDetailsFor(invite: Invite): UnitDetails {
  const landlord = landlords.get(invite.landlordId);
  const unit = landlord?.properties
    .find(p => p.id === invite.propertyId)
    ?.units.find(u => u.id === invite.unitId);
  if (!unit) {
    return {
      areas: SAMPLE_AREAS,
      baselinePhotos: {},
      baselineRecordedOn: invite === sampleInvite ? 'Nov 2' : undefined,
      landlordName: invite.landlordName,
    };
  }
  return {
    areas: unit.areas,
    baselinePhotos: unit.baselinePhotos ?? {},
    baselineRecordedOn: unit.baselineRecordedOn,
    landlordName: invite.landlordName,
  };
}

export function saveTenant(id: string, snapshot: TenantSnapshot) {
  tenants.set(id, snapshot);
}

export function recordInvite(invite: Invite) {
  invites = [
    invite,
    ...invites.filter(i => key(i.email) !== key(invite.email)),
  ];
}

export function withdrawInvite(propertyId: string, unitId: string) {
  invites = invites.filter(
    i => !(i.propertyId === propertyId && i.unitId === unitId),
  );
}

export function latestInvite(): Invite {
  return invites[0] ?? sampleInvite;
}

export function findInvite(email: string): Invite | undefined {
  return invites.find(i => key(i.email) === key(email));
}

export function markUnlinked(email: string) {
  unlinkedTenants.add(key(email));
}

export function inviteFor(email: string): Invite | undefined {
  return acceptedInvites.get(key(email));
}

export function isUnlinked(email: string) {
  return unlinkedTenants.has(key(email)) && !acceptedInvites.has(key(email));
}

export function acceptInvite(invite: Invite, tenantName: string) {
  acceptedInvites.set(key(invite.email), invite);
  unlinkedTenants.delete(key(invite.email));
  invites = invites.filter(i => key(i.email) !== key(invite.email));

  const landlord = landlords.get(invite.landlordId);
  if (!landlord) return;
  const name = tenantName.trim() || nameFromEmail(invite.email);
  landlords.set(invite.landlordId, {
    ...landlord,
    properties: landlord.properties.map(property =>
      property.id !== invite.propertyId
        ? property
        : {
            ...property,
            units: property.units.map(unit =>
              unit.id !== invite.unitId || !unit.tenant
                ? unit
                : {
                    ...unit,
                    tenant: {
                      ...unit.tenant,
                      status: 'joined',
                      name,
                      joinedOn: shortDate(),
                    },
                  },
            ),
          },
    ),
    activity: [
      {
        id: makeId('activity'),
        title: `${name} joined Unit ${invite.unit}`,
        detail: 'Today • They can now see the move-in baseline',
      },
      ...landlord.activity,
    ],
  });
}

export function declineInvite(invite: Invite, tenantName: string) {
  invites = invites.filter(i => key(i.email) !== key(invite.email));
  const landlord = landlords.get(invite.landlordId);
  if (!landlord) return;
  const name = tenantName.trim() || nameFromEmail(invite.email);
  landlords.set(invite.landlordId, {
    ...landlord,
    properties: landlord.properties.map(property =>
      property.id !== invite.propertyId
        ? property
        : {
            ...property,
            units: property.units.map(unit =>
              unit.id !== invite.unitId || !unit.tenant
                ? unit
                : {
                    ...unit,
                    tenant: {
                      ...unit.tenant,
                      status: 'declined',
                      declinedOn: shortDate(),
                    },
                  },
            ),
          },
    ),
    activity: [
      {
        id: makeId('activity'),
        title: `${name} declined the invite for Unit ${invite.unit}`,
        detail: 'Today • Check the email or invite someone else',
      },
      ...landlord.activity,
    ],
  });
}

export function resetDemoStore() {
  landlords.clear();
  tenants.clear();
  acceptedInvites.clear();
  unlinkedTenants.clear();
  invites = [];
  nextId = 1;
}
