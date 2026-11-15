import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export const MAX_AREAS = 10;
export const MIN_AREAS = 2;
export const DEFAULT_AREAS = [
  'Living room wall',
  'Kitchen sink',
  'Bathroom ceiling',
  'Bedroom floor',
];

export type TenantLink = {
  email: string;
  name?: string;
  status: 'pending' | 'joined';
  invitedOn: string;
  joinedOn?: string;
};

export type Unit = {
  id: string;
  name: string;
  bedrooms: string;
  bathrooms: string;
  tenant?: TenantLink;
  areas: string[];
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

export type ToastMessage = { title: string; detail?: string };

export type NewProperty = {
  address: string;
  unit: string;
  bedrooms: string;
  bathrooms: string;
  tenantEmail?: string;
};

export type UnitChanges = Pick<Unit, 'name' | 'bedrooms' | 'bathrooms' | 'areas'>;

type LandlordDemo = {
  consented: boolean;
  properties: Property[];
  activity: Activity[];
  toast: ToastMessage | null;
  acceptConsent: () => void;
  addProperty: (input: NewProperty) => void;
  updateUnit: (propertyId: string, unitId: string, changes: UnitChanges) => void;
  removeTenant: (propertyId: string, unitId: string) => void;
  advanceDemo: (propertyId: string, unitId: string) => void;
  dismissToast: () => void;
  findUnit: (
    propertyId: string,
    unitId: string,
  ) => { property: Property; unit: Unit } | undefined;
};

const LandlordDemoContext = createContext<LandlordDemo | null>(null);

function shortDate(date = new Date()) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function nameFromEmail(email: string) {
  const local = email.split('@')[0] ?? '';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function splitAddress(address: string) {
  const [street, ...rest] = address.split(',').map(part => part.trim());
  return { street: street || address.trim(), city: rest.join(', ') };
}

let nextId = 1;
const makeId = (prefix: string) => `${prefix}-${nextId++}`;

export function LandlordDemoProvider({
  children,
  initialConsented = false,
}: PropsWithChildren<{ initialConsented?: boolean }>) {
  const [consented, setConsented] = useState(initialConsented);
  const [properties, setProperties] = useState<Property[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);

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

  const addProperty = useCallback((input: NewProperty) => {
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
    setProperties(current => [
      ...current,
      { id: makeId('property'), street, city, units: [unit] },
    ]);
    setToast(
      email
        ? { title: `Unit ${unitName} added. Invite sent.`, detail: email }
        : { title: `Unit ${unitName} added.` },
    );
  }, []);

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
      setToast({ title: 'Tenant removed from unit.' });
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
            detail: 'Today • She can now see the move-in baseline',
          },
          ...current,
        ]);
      } else if (!unit.baselineRecordedOn) {
        patchUnit(propertyId, unitId, u => ({
          ...u,
          baselineRecordedOn: shortDate(),
        }));
      }
    },
    [findUnit, patchUnit],
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
      advanceDemo,
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
      advanceDemo,
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
