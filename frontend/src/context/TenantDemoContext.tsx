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
import { tenantApi, type TenantState } from '../services/leaseService';
import { uploadPhoto, type PhotoKind } from '../services/photoService';
import {
  acceptInvite,
  declineInvite,
  findInvite,
  getTenant,
  inviteFor,
  isUnlinked,
  sampleInvite,
  saveTenant,
  shortDate,
  unitDetailsFor,
  updateTenantInspection,
  type Inspection,
  type Invite,
  type PhotoMap,
  type UnitDetails,
} from '../data/demoStore';

type Stage = 'loading' | 'invite' | 'welcome' | 'consent' | 'ready';

type TenantDemo = {
  stage: Stage;
  unit: Invite | null;
  details: UnitDetails | null;
  pendingInvite: Invite | null;
  isNewTenant: boolean;
  baselineReviewed: boolean;
  movePhotos: PhotoMap;
  error: string;
  acceptPendingInvite: () => void;
  declinePendingInvite: () => void;
  finishWelcome: () => void;
  acceptConsent: () => void;
  checkForInvite: () => boolean;
  markBaselineReviewed: () => void;
  setMovePhoto: (area: string, uri: string) => void;
  inspection?: Inspection;
  setInspectionPhoto: (area: string, uri: string) => void;
  setInspectionNote: (area: string, note: string) => void;
  submitInspection: () => void;
  sendAvailability: (slotIds: string[]) => void;
  declineTimes: () => void;
};

const TenantDemoContext = createContext<TenantDemo | null>(null);

export function TenantDemoProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id ?? 'guest';
  const email = user?.email ?? '';
  const name = user?.name ?? '';
  const saved = getTenant(userId);

  const [welcomed, setWelcomed] = useState(saved.welcomed);
  const [consented, setConsented] = useState(saved.consented);
  const [baselineReviewed, setBaselineReviewed] = useState(
    Boolean(saved.baselineReviewed),
  );
  const [movePhotos, setMovePhotos] = useState<PhotoMap>(
    saved.movePhotos ?? {},
  );
  const [unit, setUnit] = useState<Invite | null>(() =>
    LEASE_API_ENABLED
      ? null
      : inviteFor(email) ?? (isUnlinked(email) ? null : sampleInvite),
  );
  const [pendingInvite, setPendingInvite] = useState<Invite | null>(() =>
    LEASE_API_ENABLED ? null : findInvite(email) ?? null,
  );
  // Server copy of the unit's baseline and current inspection (API mode).
  const [remoteDetails, setRemoteDetails] = useState<UnitDetails | null>(null);
  const [loading, setLoading] = useState(LEASE_API_ENABLED);
  const [error, setError] = useState('');
  const isNewTenant = unit !== sampleInvite;

  useEffect(() => {
    saveTenant(userId, { welcomed, consented, baselineReviewed, movePhotos });
  }, [userId, welcomed, consented, baselineReviewed, movePhotos]);

  // ----- server sync (skipped in Jest) -----
  const inFlight = useRef(0);
  const uploads = useRef(new Set<Promise<unknown>>());

  const apply = useCallback((state: TenantState) => {
    setWelcomed(state.welcomed);
    setConsented(state.consented);
    setBaselineReviewed(state.baselineReviewed);
    setMovePhotos(state.movePhotos);
    setUnit(state.unit);
    setPendingInvite(state.pendingInvite);
    setRemoteDetails(state.details);
  }, []);

  const refresh = useCallback(async () => {
    if (!LEASE_API_ENABLED || inFlight.current) return;
    try {
      const state = await tenantApi.state();
      if (!inFlight.current) apply(state);
      setError('');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not load your unit.',
      );
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    if (!LEASE_API_ENABLED) return;
    refresh();
    const timer = setInterval(refresh, 10000);
    const listener = AppStatus.addEventListener('change', status => {
      if (status === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [refresh]);

  const sync = useCallback(
    (call: () => Promise<TenantState>) => {
      if (!LEASE_API_ENABLED) return;
      inFlight.current += 1;
      Promise.allSettled([...uploads.current])
        .then(call)
        .then(
          state => {
            inFlight.current -= 1;
            if (!inFlight.current) apply(state);
            setError('');
          },
          failure => {
            inFlight.current -= 1;
            setError(
              failure instanceof Error
                ? failure.message
                : 'That change was not saved.',
            );
            refresh();
          },
        );
    },
    [apply, refresh],
  );

  const upload = useCallback(
    (
      uri: string,
      target: { kind: PhotoKind; area: string; inspectionId?: string },
      setPhoto: (value?: string) => void,
    ) => {
      setPhoto(uri);
      if (!LEASE_API_ENABLED || !unit) return;
      inFlight.current += 1;
      const task = uploadPhoto(uri, { ...target, unitId: unit.unitId })
        .then(url => setPhoto(url))
        .catch(failure => {
          setPhoto(undefined);
          setError(
            failure instanceof Error
              ? failure.message
              : 'The photo did not upload.',
          );
        })
        .finally(() => {
          inFlight.current -= 1;
          uploads.current.delete(task);
        });
      uploads.current.add(task);
    },
    [unit],
  );

  // ----- actions -----
  const acceptPendingInvite = useCallback(() => {
    if (!pendingInvite) return;
    if (LEASE_API_ENABLED) {
      sync(() => tenantApi.acceptInvite(pendingInvite.unitId));
    } else {
      acceptInvite(pendingInvite, name);
    }
    setUnit(pendingInvite);
    setPendingInvite(null);
    setBaselineReviewed(false);
    setMovePhotos({});
    setWelcomed(false);
  }, [pendingInvite, name, sync]);

  const declinePendingInvite = useCallback(() => {
    if (!pendingInvite) return;
    if (LEASE_API_ENABLED) {
      sync(() => tenantApi.declineInvite(pendingInvite.unitId));
    } else {
      declineInvite(pendingInvite, name);
    }
    setPendingInvite(null);
  }, [pendingInvite, name, sync]);

  const checkForInvite = useCallback(() => {
    if (LEASE_API_ENABLED) {
      // A found invite switches the app to the invite screen on its own.
      refresh();
      return false;
    }
    const invite = findInvite(email);
    if (!invite) return false;
    setPendingInvite(invite);
    return true;
  }, [email, refresh]);

  const stage: Stage = loading
    ? 'loading'
    : pendingInvite
    ? 'invite'
    : !welcomed
    ? 'welcome'
    : !consented
    ? 'consent'
    : 'ready';

  const [, setRevision] = useState(0);
  const details = LEASE_API_ENABLED
    ? remoteDetails
    : unit
    ? unitDetailsFor(unit)
    : null;
  const inspection = details?.inspection;
  const tenantName = name.trim() || email;

  const patchRemoteInspection = useCallback(
    (patch: (current: Inspection) => Inspection) =>
      setRemoteDetails(current =>
        current?.inspection
          ? { ...current, inspection: patch(current.inspection) }
          : current,
      ),
    [],
  );

  const changeInspection = useCallback(
    (
      patch: Partial<Inspection>,
      activity?: { title: string; detail: string },
    ) => {
      if (!unit || !inspection) return;
      if (LEASE_API_ENABLED) {
        patchRemoteInspection(current => ({ ...current, ...patch }));
      } else {
        updateTenantInspection(unit, inspection.id, patch, activity);
        setRevision(r => r + 1);
      }
    },
    [unit, inspection, patchRemoteInspection],
  );

  const setInspectionPhoto = useCallback(
    (area: string, uri: string) => {
      if (!inspection) return;
      if (!LEASE_API_ENABLED) {
        changeInspection({ photos: { ...inspection.photos, [area]: uri } });
        return;
      }
      upload(
        uri,
        { kind: 'inspection', area, inspectionId: inspection.id },
        value =>
          patchRemoteInspection(current => {
            const photos = { ...current.photos };
            if (value) photos[area] = value;
            else delete photos[area];
            return { ...current, photos };
          }),
      );
    },
    [inspection, changeInspection, upload, patchRemoteInspection],
  );

  const setInspectionNote = useCallback(
    (area: string, note: string) => {
      if (!inspection) return;
      const notes = { ...inspection.notes, [area]: note };
      if (LEASE_API_ENABLED) {
        // Saved locally until submit; the server gets them with the inspection.
        patchRemoteInspection(current => ({ ...current, notes }));
      } else {
        changeInspection({ notes });
      }
    },
    [inspection, changeInspection, patchRemoteInspection],
  );

  const setMovePhoto = useCallback(
    (area: string, uri: string) => {
      upload(uri, { kind: 'move_in', area }, value =>
        setMovePhotos(current => {
          const photos = { ...current };
          if (value) photos[area] = value;
          else delete photos[area];
          return photos;
        }),
      );
    },
    [upload],
  );

  const submitInspection = useCallback(() => {
    changeInspection(
      { status: 'submitted', submittedOn: shortDate() },
      {
        title: `${tenantName} submitted the inspection for Unit ${unit?.unit}`,
        detail: 'Today • Ready for AI comparison',
      },
    );
    if (inspection) {
      sync(() =>
        tenantApi.submitInspection(inspection.id, inspection.notes ?? {}),
      );
    }
  }, [changeInspection, tenantName, unit?.unit, inspection, sync]);

  const sendAvailability = useCallback(
    (slotIds: string[]) => {
      changeInspection(
        { status: 'times-sent', tenantSlots: slotIds },
        {
          title: `${tenantName} sent their availability`,
          detail: `Today • Unit ${unit?.unit} • Confirm a time`,
        },
      );
      if (inspection) {
        sync(() => tenantApi.sendAvailability(inspection.id, slotIds));
      }
    },
    [changeInspection, tenantName, unit?.unit, inspection, sync],
  );

  const declineTimes = useCallback(() => {
    changeInspection(
      { status: 'times-declined', tenantSlots: [] },
      {
        title: `None of your times work for ${tenantName}`,
        detail: `Today • Unit ${unit?.unit} • Propose new times`,
      },
    );
    if (inspection) sync(() => tenantApi.sendAvailability(inspection.id, []));
  }, [changeInspection, tenantName, unit?.unit, inspection, sync]);

  const value = useMemo(
    () => ({
      stage,
      unit,
      details,
      pendingInvite,
      isNewTenant,
      baselineReviewed,
      movePhotos,
      error,
      acceptPendingInvite,
      declinePendingInvite,
      finishWelcome: () => {
        setWelcomed(true);
        sync(() => tenantApi.progress({ welcomed: true }));
      },
      acceptConsent: () => {
        setConsented(true);
        sync(() => tenantApi.progress({ consented: true }));
      },
      checkForInvite,
      markBaselineReviewed: () => {
        setBaselineReviewed(true);
        sync(() => tenantApi.progress({ baselineReviewed: true }));
      },
      setMovePhoto,
      inspection,
      setInspectionPhoto,
      setInspectionNote,
      submitInspection,
      sendAvailability,
      declineTimes,
    }),
    [
      stage,
      unit,
      details,
      pendingInvite,
      isNewTenant,
      baselineReviewed,
      movePhotos,
      error,
      sync,
      acceptPendingInvite,
      declinePendingInvite,
      checkForInvite,
      setMovePhoto,
      inspection,
      setInspectionPhoto,
      setInspectionNote,
      submitInspection,
      sendAvailability,
      declineTimes,
    ],
  );

  return (
    <TenantDemoContext.Provider value={value}>
      {children}
    </TenantDemoContext.Provider>
  );
}

export function useTenantDemo() {
  const value = useContext(TenantDemoContext);
  if (!value) {
    throw new Error('useTenantDemo must be used inside TenantDemoProvider');
  }
  return value;
}
