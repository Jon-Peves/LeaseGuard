import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState as AppStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { LEASE_API_ENABLED } from '../services/leaseConfig';
import { landlordApi, type LandlordState } from '../services/leaseService';
import { uploadPhoto } from '../services/photoService';
import {
  currentInspection,
  getLandlord,
  makeId,
  nameFromEmail,
  recordInvite,
  withdrawInvite,
  saveLandlord,
  shortDate,
  type Activity,
  type Inspection,
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

export type NewInspection =
  | { kind: 'remote'; dueDate: string; areas: string[] }
  | {
      kind: 'inperson';
      areas: string[];
      slots: { id: string; date: string; time: string }[];
    };

export type UnitChanges = Pick<
  Unit,
  'name' | 'bedrooms' | 'bathrooms' | 'areas'
>;

type LandlordDemo = {
  loading: boolean;
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
  setBaselineNote: (
    propertyId: string,
    unitId: string,
    area: string,
    note: string,
  ) => void;
  renameArea: (
    propertyId: string,
    unitId: string,
    from: string,
    to: string,
  ) => void;
  scheduleInspection: (
    propertyId: string,
    unitId: string,
    input: NewInspection,
  ) => void;
  confirmInspectionTime: (
    propertyId: string,
    unitId: string,
    slotId: string,
  ) => void;
  cancelInspection: (propertyId: string, unitId: string) => void;
  rerunReview: (propertyId: string, unitId: string) => void;
  refresh: () => void;
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
  const [loading, setLoading] = useState(LEASE_API_ENABLED);

  useEffect(() => {
    saveLandlord(userId, { consented, properties, activity });
  }, [userId, consented, properties, activity]);

  // ----- server sync (skipped in Jest, where the demo store is the backend) -----
  // Screens update right away; the matching request runs behind them and the
  // server's answer replaces local state once nothing else is in flight.
  const inFlight = useRef(0);
  const uploads = useRef(new Set<Promise<unknown>>());

  const apply = useCallback((state: LandlordState) => {
    setConsented(state.consented);
    setProperties(state.properties);
    setActivity(state.activity);
  }, []);

  const refresh = useCallback(async () => {
    if (!LEASE_API_ENABLED || inFlight.current) return;
    try {
      const state = await landlordApi.state();
      if (!inFlight.current) apply(state);
    } catch (error) {
      setToast({
        title: 'Could not load your properties.',
        detail: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    if (!LEASE_API_ENABLED) return;
    refresh();
    // Picks up tenant replies and AI results without a manual reload.
    const timer = setInterval(refresh, 8000);
    const listener = AppStatus.addEventListener('change', status => {
      if (status === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [refresh]);

  const sync = useCallback(
    (call: () => Promise<LandlordState>) => {
      if (!LEASE_API_ENABLED) return;
      inFlight.current += 1;
      Promise.allSettled([...uploads.current])
        .then(call)
        .then(
          state => {
            inFlight.current -= 1;
            if (!inFlight.current) apply(state);
          },
          error => {
            inFlight.current -= 1;
            setToast({
              title: 'That change was not saved.',
              detail: error instanceof Error ? error.message : undefined,
            });
            refresh();
          },
        );
    },
    [apply, refresh],
  );

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
      sync(() =>
        landlordApi.addProperty({
          propertyId,
          unitId: unit.id,
          street,
          city,
          unit: unitName,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          areas: unit.areas,
          email,
        }),
      );
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
    [userId, user?.name, user?.email, sync],
  );

  const updateUnit = useCallback(
    (propertyId: string, unitId: string, changes: UnitChanges) => {
      patchUnit(propertyId, unitId, unit => ({ ...unit, ...changes }));
      sync(() =>
        landlordApi.updateUnit(unitId, {
          name: changes.name,
          bedrooms: changes.bedrooms,
          bathrooms: changes.bathrooms,
          areas: changes.areas,
        }),
      );
      setToast({ title: 'Unit saved.' });
    },
    [patchUnit, sync],
  );

  const removeTenant = useCallback(
    (propertyId: string, unitId: string) => {
      patchUnit(propertyId, unitId, unit => ({ ...unit, tenant: undefined }));
      withdrawInvite(propertyId, unitId);
      sync(() => landlordApi.removeTenant(unitId));
      setToast({ title: 'Tenant removed from unit.' });
    },
    [patchUnit, sync],
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
      sync(() => landlordApi.invite(unitId, address));
      setToast({ title: 'Invite sent.', detail: address });
    },
    [properties, patchUnit, userId, user?.name, user?.email, sync],
  );

  const cancelInvite = useCallback(
    (propertyId: string, unitId: string) => {
      patchUnit(propertyId, unitId, unit => ({ ...unit, tenant: undefined }));
      withdrawInvite(propertyId, unitId);
      sync(() => landlordApi.removeTenant(unitId));
      setToast({ title: 'Invite canceled.' });
    },
    [patchUnit, sync],
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
      const setPhoto = (value?: string) =>
        patchUnit(propertyId, unitId, u => {
          const photos = { ...u.baselinePhotos };
          if (value) photos[area] = value;
          else delete photos[area];
          return { ...u, baselinePhotos: photos };
        });
      setPhoto(uri);
      if (!LEASE_API_ENABLED) return;
      inFlight.current += 1;
      const upload = uploadPhoto(uri, { kind: 'baseline', unitId, area })
        .then(url => setPhoto(url))
        .catch(error => {
          setPhoto(undefined);
          setToast({
            title: `${area} photo did not upload.`,
            detail: error instanceof Error ? error.message : undefined,
          });
        })
        .finally(() => {
          inFlight.current -= 1;
          uploads.current.delete(upload);
        });
      uploads.current.add(upload);
    },
    [patchUnit],
  );

  const patchInspection = useCallback(
    (
      propertyId: string,
      unitId: string,
      patch: (inspection: Inspection) => Inspection,
    ) => {
      patchUnit(propertyId, unitId, u => {
        const list = u.inspections ?? [];
        if (!list.length) return u;
        return {
          ...u,
          inspections: [...list.slice(0, -1), patch(list[list.length - 1])],
        };
      });
    },
    [patchUnit],
  );

  const scheduleInspection = useCallback(
    (propertyId: string, unitId: string, input: NewInspection) => {
      const inspection: Inspection = {
        id: makeId('inspection'),
        kind: input.kind,
        areas: input.areas,
        status: input.kind === 'remote' ? 'scheduled' : 'awaiting-times',
        createdOn: shortDate(),
        dueDate: input.kind === 'remote' ? input.dueDate : undefined,
        slots: input.kind === 'inperson' ? input.slots : undefined,
        photos: {},
      };
      patchUnit(propertyId, unitId, u => ({
        ...u,
        inspections: [...(u.inspections ?? []), inspection],
      }));
      sync(() =>
        landlordApi.scheduleInspection(unitId, {
          id: inspection.id,
          kind: input.kind,
          areas: input.areas,
          dueDate: inspection.dueDate,
          slots: inspection.slots,
        }),
      );
      setToast(
        input.kind === 'remote'
          ? {
              title: 'Inspection scheduled.',
              detail: 'Your tenant was notified.',
            }
          : {
              title: 'Times sent.',
              detail: 'Your tenant will pick what works.',
            },
      );
    },
    [patchUnit, sync],
  );

  const inspectionId = useCallback(
    (propertyId: string, unitId: string) => {
      const unit = properties
        .find(p => p.id === propertyId)
        ?.units.find(u => u.id === unitId);
      return unit ? currentInspection(unit)?.id : undefined;
    },
    [properties],
  );

  const confirmInspectionTime = useCallback(
    (propertyId: string, unitId: string, slotId: string) => {
      const id = inspectionId(propertyId, unitId);
      patchInspection(propertyId, unitId, i => ({
        ...i,
        status: 'confirmed',
        confirmedSlot: slotId,
      }));
      if (id) sync(() => landlordApi.confirmTime(id, slotId));
      setToast({ title: 'Inspection time confirmed.' });
    },
    [patchInspection, inspectionId, sync],
  );

  const cancelInspection = useCallback(
    (propertyId: string, unitId: string) => {
      const id = inspectionId(propertyId, unitId);
      patchUnit(propertyId, unitId, u => ({
        ...u,
        inspections: (u.inspections ?? []).slice(0, -1),
      }));
      if (id) sync(() => landlordApi.cancelInspection(id));
    },
    [patchUnit, inspectionId, sync],
  );

  const rerunReview = useCallback(
    (propertyId: string, unitId: string) => {
      const id = inspectionId(propertyId, unitId);
      if (!id) return;
      patchInspection(propertyId, unitId, i => ({
        ...i,
        ai: { status: 'pending', results: {} },
      }));
      sync(() => landlordApi.rerunReview(id));
    },
    [patchInspection, inspectionId, sync],
  );

  const saveBaseline = useCallback(
    (propertyId: string, unitId: string) => {
      patchUnit(propertyId, unitId, u => ({
        ...u,
        baselineRecordedOn: shortDate(),
      }));
      const notes = findUnit(propertyId, unitId)?.unit.baselineNotes ?? {};
      sync(() => landlordApi.saveBaseline(unitId, notes));
      setToast({ title: 'Move-in baseline saved.' });
    },
    [patchUnit, sync, findUnit],
  );

  const setBaselineNote = useCallback(
    (propertyId: string, unitId: string, area: string, note: string) => {
      // Kept on the phone until the landlord saves the baseline.
      patchUnit(propertyId, unitId, u => ({
        ...u,
        baselineNotes: { ...u.baselineNotes, [area]: note },
      }));
    },
    [patchUnit],
  );

  const renameArea = useCallback(
    (propertyId: string, unitId: string, from: string, to: string) => {
      const name = to.trim();
      if (!name || name === from) return;
      const move = <T,>(map: Record<string, T> | undefined) => {
        if (!map || !(from in map)) return map;
        const { [from]: value, ...rest } = map;
        return { ...rest, [name]: value };
      };
      patchUnit(propertyId, unitId, u => ({
        ...u,
        areas: u.areas.map(a => (a === from ? name : a)),
        baselinePhotos: move(u.baselinePhotos),
        baselineNotes: move(u.baselineNotes),
        inspections: u.inspections?.map(i => ({
          ...i,
          areas: i.areas.map(a => (a === from ? name : a)),
          photos: move(i.photos) ?? {},
          notes: move(i.notes),
          ai: i.ai && { ...i.ai, results: move(i.ai.results) ?? {} },
        })),
      }));
      sync(() => landlordApi.renameArea(unitId, from, name));
    },
    [patchUnit, sync],
  );

  const value = useMemo(
    () => ({
      loading,
      consented,
      properties,
      activity,
      toast,
      acceptConsent: () => {
        setConsented(true);
        sync(landlordApi.consent);
      },
      addProperty,
      updateUnit,
      removeTenant,
      sendInvite,
      cancelInvite,
      advanceDemo,
      setBaselinePhoto,
      saveBaseline,
      setBaselineNote,
      renameArea,
      scheduleInspection,
      confirmInspectionTime,
      cancelInspection,
      rerunReview,
      refresh,
      dismissToast: () => setToast(null),
      findUnit,
    }),
    [
      loading,
      sync,
      rerunReview,
      refresh,
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
      setBaselineNote,
      renameArea,
      scheduleInspection,
      confirmInspectionTime,
      cancelInspection,
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
