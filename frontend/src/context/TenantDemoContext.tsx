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
  acceptInvite,
  declineInvite,
  findInvite,
  getTenant,
  inviteFor,
  isUnlinked,
  sampleInvite,
  saveTenant,
  unitDetailsFor,
  type Invite,
  type PhotoMap,
  type UnitDetails,
} from '../data/demoStore';

type Stage = 'invite' | 'welcome' | 'consent' | 'ready';

type TenantDemo = {
  stage: Stage;
  unit: Invite | null;
  details: UnitDetails | null;
  pendingInvite: Invite | null;
  isNewTenant: boolean;
  baselineReviewed: boolean;
  movePhotos: PhotoMap;
  acceptPendingInvite: () => void;
  declinePendingInvite: () => void;
  finishWelcome: () => void;
  acceptConsent: () => void;
  checkForInvite: () => boolean;
  markBaselineReviewed: () => void;
  setMovePhoto: (area: string, uri: string) => void;
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
  const [unit, setUnit] = useState<Invite | null>(
    () => inviteFor(email) ?? (isUnlinked(email) ? null : sampleInvite),
  );
  const [pendingInvite, setPendingInvite] = useState<Invite | null>(
    () => findInvite(email) ?? null,
  );
  const isNewTenant = unit !== sampleInvite;

  useEffect(() => {
    saveTenant(userId, { welcomed, consented, baselineReviewed, movePhotos });
  }, [userId, welcomed, consented, baselineReviewed, movePhotos]);

  const acceptPendingInvite = useCallback(() => {
    if (!pendingInvite) return;
    acceptInvite(pendingInvite, name);
    setUnit(pendingInvite);
    setPendingInvite(null);
    setBaselineReviewed(false);
    setMovePhotos({});
    setWelcomed(false);
  }, [pendingInvite, name]);

  const declinePendingInvite = useCallback(() => {
    if (!pendingInvite) return;
    declineInvite(pendingInvite, name);
    setPendingInvite(null);
  }, [pendingInvite, name]);

  const checkForInvite = useCallback(() => {
    const invite = findInvite(email);
    if (!invite) return false;
    setPendingInvite(invite);
    return true;
  }, [email]);

  const stage: Stage = pendingInvite
    ? 'invite'
    : !welcomed
    ? 'welcome'
    : !consented
    ? 'consent'
    : 'ready';

  const details = unit ? unitDetailsFor(unit) : null;

  const value = useMemo(
    () => ({
      stage,
      unit,
      details,
      pendingInvite,
      isNewTenant,
      baselineReviewed,
      movePhotos,
      acceptPendingInvite,
      declinePendingInvite,
      finishWelcome: () => setWelcomed(true),
      acceptConsent: () => setConsented(true),
      checkForInvite,
      markBaselineReviewed: () => setBaselineReviewed(true),
      setMovePhoto: (area: string, uri: string) =>
        setMovePhotos(current => ({ ...current, [area]: uri })),
    }),
    [
      stage,
      unit,
      details,
      pendingInvite,
      isNewTenant,
      baselineReviewed,
      movePhotos,
      acceptPendingInvite,
      declinePendingInvite,
      checkForInvite,
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
