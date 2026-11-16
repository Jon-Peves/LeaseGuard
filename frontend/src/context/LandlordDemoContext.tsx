import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useAuth } from './AuthContext';
import {
  getLandlord,
  makeId,
  nameFromEmail,
  recordInvite,
  withdrawInvite,
  saveLandlord,
  shortDate,
  type Activity,
  type Property,
  type TenantLink,
  type Unit,
} from '../data/demoStore';

export const MAX_AREAS = 10;
export const MIN_AREAS = 2;
export const DEFAULT_AREAS = [
  'Living room wall',
  'Kitchen sink',
  'Bathroom ceiling',
  'Bedroom floor',
];

export type { Activity, Property, TenantLink, Unit } from '../data/demoStore';

export type ToastMessage = { title: string; detail?: string };

export type NewProperty = {
  address: string;
  unit: string;
  bedrooms: string;
  bathrooms: string;
  tenantEmail?: string;
};

export type UnitChanges = Pick<
  Unit,
  'name' | 'bedrooms' | 'bathrooms' | 'areas'
>;

type LandlordDemo = {
  consented: boolean;
  properties: Property[];
  activity: Activity[];
  toast: ToastMessage | null;
  acceptConsent: () => void;
  addProperty: (input: NewProperty) => void;
  updateUnit: (
    propertyId: string,
    unitId: string,
    changes: UnitChanges,
  ) => void;
  removeTenant: (propertyId: string, unitId: string) => void;
  sendInvite: (propertyId: string, unitId: string, email: string) => void;
  cancelInvite: (propertyId: string, unitId: string) => void;
  advanceDemo: (propertyId: string, unitId: string) => void;
  setBaselinePhoto: (
    propertyId: string,
    unitId: string,
    area: string,
    uri: string,
  ) => void;
  saveBaseline: (propertyId: string, unitId: string) => void;
  dismissToast: () => void;
  findUnit: (
    propertyId: string,
    unitId: string,
  ) => { property: Property; unit: Unit } | undefined;
};

const LandlordDemoContext = createContext<LandlordDemo | null>(null);

function splitAddress(address: string) {
  const [street, ...rest] = address.split(',').map(part => part.trim());
  return { street: street || address.trim(), city: rest.join(', ') };
}

export function LandlordDemoProvider({
  children,
  initialConsented = false,
}: PropsWithChildren<{ initialConsented?: boolean }>) {
  const { user } = useAuth();
  const userId = user?.id ?? 'guest';
  const saved = getLandlord(userId);
  const [consented, setConsented] = useState(
    saved?.consented ?? initialConsented,
  );
  const [properties, setProperties] = useState<Property[]>(
    saved?.properties ?? [],
  );
  const [activity, setActivity] = useState<Activity[]>(saved?.activity ?? []);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    saveLandlord(userId, { consented, properties, activity });
  }, [userId, consented, properties, activity]);

  const patchUnit = useCallback(
    (propertyId: string, unitId: string, patch: (unit: Unit) => Unit) => {
      setProperties(current =>
        current.map(property =>
          property.id !== propertyId
            ? property
            : {
                ...property,
                units: property.units.map(unit =>
                  unit.id === unitId ? patch(unit) : unit,
                ),
              },
        ),
      );
    },
    [],
  );

  const addProperty = useCallback(
    (input: NewProperty) => {
      const { street, city } = splitAddress(input.address);
      const email = input.tenantEmail?.trim();
      const unitName = input.unit.trim();
      const unit: Unit = {
        id: makeId('unit'),
        name: unitName,
        bedrooms: input.bedrooms.trim(),
        bathrooms: input.bathrooms.trim(),
        areas: [...DEFAULT_AREAS],
        tenant: email
          ? { email, status: 'pending', invitedOn: shortDate() }
          : undefined,
      };
      const propertyId = makeId('property');
      setProperties(current => [
        ...current,
        { id: propertyId, street, city, units: [unit] },
      ]);
      if (email) {
        recordInvite({
          email,
          landlordId: userId,
          landlordName: user?.name?.trim() || user?.email || 'Your landlord',
          propertyId,
          unitId: unit.id,
          street,
          city,
          unit: unitName,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          areaCount: unit.areas.length,
        });
      }
      setToast(
        email
          ? { title: `Unit ${unitName} added. Invite sent.`, detail: email }
          : { title: `Unit ${unitName} added.` },
      );
    },
    [userId, user?.name, user?.email],
  );

  const updateUnit = useCallback(
    (propertyId: string, unitId: string, changes: UnitChanges) => {
      patchUnit(propertyId, unitId, unit => ({ ...unit, ...changes }));
      setToast({ title: 'Unit saved.' });
    },
    [patchUnit],
  );

  const removeTenant = useCallback(
    (propertyId: string, unitId: string) => {
      patchUnit(propertyId, unitId, unit => ({ ...unit, tenant: undefined }));
      withdrawInvite(propertyId, unitId);
      setToast({ title: 'Tenant removed from unit.' });
    },
    [patchUnit],
  );

  const sendInvite = useCallback(
    (propertyId: string, unitId: string, email: string) => {
      const property = properties.find(p => p.id === propertyId);
      const unit = property?.units.find(u => u.id === unitId);
      if (!property || !unit) return;
      const address = email.trim();
      withdrawInvite(propertyId, unitId);
      recordInvite({
        email: address,
        landlordId: userId,
        landlordName: user?.name?.trim() || user?.email || 'Your landlord',
        propertyId,
        unitId,
        street: property.street,
        city: property.city,
        unit: unit.name,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        areaCount: unit.areas.length,
      });
      patchUnit(propertyId, unitId, u => ({
        ...u,
        tenant: { email: address, status: 'pending', invitedOn: shortDate() },
      }));
      setToast({ title: 'Invite sent.', detail: address });
    },
    [properties, patchUnit, userId, user?.name, user?.email],
  );

  const cancelInvite = useCallback(
    (propertyId: string, unitId: string) => {
      patchUnit(propertyId, unitId, unit => ({ ...unit, tenant: undefined }));
      withdrawInvite(propertyId, unitId);
      setToast({ title: 'Invite canceled.' });
    },
    [patchUnit],
  );

  const findUnit = useCallback(
    (propertyId: string, unitId: string) => {
      const property = properties.find(p => p.id === propertyId);
      const unit = property?.units.find(u => u.id === unitId);
      return property && unit ? { property, unit } : undefined;
    },
    [properties],
  );

  const advanceDemo = useCallback(
    (propertyId: string, unitId: string) => {
      const found = findUnit(propertyId, unitId);
      if (!found) return;
      const { unit } = found;
      if (unit.tenant?.status === 'pending') {
        const name = nameFromEmail(unit.tenant.email);
        patchUnit(propertyId, unitId, u => ({
          ...u,
          tenant: u.tenant && {
            ...u.tenant,
            status: 'joined',
            name,
            joinedOn: shortDate(),
          },
        }));
        setActivity(current => [
          {
            id: makeId('activity'),
            title: `${name} joined Unit ${unit.name}`,
            detail: 'Today • They can now see the move-in baseline',
          },
          ...current,
        ]);
      }
    },
    [findUnit, patchUnit],
  );

  const setBaselinePhoto = useCallback(
    (propertyId: string, unitId: string, area: string, uri: string) => {
      patchUnit(propertyId, unitId, u => ({
        ...u,
        baselinePhotos: { ...u.baselinePhotos, [area]: uri },
      }));
    },
    [patchUnit],
  );

  const saveBaseline = useCallback(
    (propertyId: string, unitId: string) => {
      patchUnit(propertyId, unitId, u => ({
        ...u,
        baselineRecordedOn: shortDate(),
      }));
      setToast({ title: 'Move-in baseline saved.' });
    },
    [patchUnit],
  );

  const value = useMemo(
    () => ({
      consented,
      properties,
      activity,
      toast,
      acceptConsent: () => setConsented(true),
      addProperty,
      updateUnit,
      removeTenant,
      sendInvite,
      cancelInvite,
      advanceDemo,
      setBaselinePhoto,
      saveBaseline,
      dismissToast: () => setToast(null),
      findUnit,
    }),
    [
      consented,
      properties,
      activity,
      toast,
      addProperty,
      updateUnit,
      removeTenant,
      sendInvite,
      cancelInvite,
      advanceDemo,
      setBaselinePhoto,
      saveBaseline,
      findUnit,
    ],
  );

  return (
    <LandlordDemoContext.Provider value={value}>
      {children}
    </LandlordDemoContext.Provider>
  );
}

export function useLandlordDemo() {
  const value = useContext(LandlordDemoContext);
  if (!value) {
    throw new Error('useLandlordDemo must be used inside LandlordDemoProvider');
  }
  return value;
}

export function firstName(tenant?: TenantLink) {
  if (!tenant) return 'your tenant';
  return (tenant.name ?? nameFromEmail(tenant.email)).split(' ')[0];
}
