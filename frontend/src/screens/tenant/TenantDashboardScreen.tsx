import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import NotificationBell from '../../components/NotificationBell';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { useAuth } from '../../context/AuthContext';
import { useTenantDemo } from '../../context/TenantDemoContext';
import { tenantMockData } from '../../data/tenantMockData';
import type {
  TenantStackParamList,
  TenantTabParamList,
} from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import Svg, { Path, Rect } from 'react-native-svg';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TenantTabParamList, 'Home'>,
  NativeStackScreenProps<TenantStackParamList>
>;

function MailIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3}
        y={5}
        width={18}
        height={14}
        rx={2}
        stroke="#B45309"
        strokeWidth={2}
      />
      <Path
        d="m3 7 9 6 9-6"
        stroke="#B45309"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function CalendarIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3}
        y={5}
        width={18}
        height={16}
        rx={2}
        stroke="#6B45D1"
        strokeWidth={2}
      />
      <Path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="#6B45D1"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function TenantDashboardScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const {
    unit,
    details,
    isNewTenant,
    checkForInvite,
    baselineReviewed,
    movePhotos,
  } = useTenantDemo();
  const ownPhotoCount = Object.keys(movePhotos).length;
  const [checked, setChecked] = useState(false);
  const first = user?.name?.trim().split(' ')[0] || user?.email || '';
  const recent = isNewTenant ? null : tenantMockData.recentMaintenance;

  const bell = (
    <NotificationBell
      unreadCount={isNewTenant ? 0 : tenantMockData.notifications.unreadCount}
      onPress={() => navigation.navigate('Notifications')}
    />
  );

  if (!unit) {
    return (
      <ScreenContainer style={styles.content}>
        <ScreenTitle title={`Hi, ${first}`} subtitle="No unit linked yet" />
        <View style={[styles.card, styles.waiting]}>
          <View style={styles.mail}>
            <MailIcon />
          </View>
          <Text style={styles.waitingTitle}>Waiting for an invite</Text>
          <Text style={styles.waitingBody}>
            Your unit appears here once your landlord invites this email:
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.waitingBody}>
            Already invited? Your landlord may have used a different email. Ask
            them to check, or sign in with the email they used.
          </Text>
          {checked ? (
            <Text accessibilityRole="alert" style={styles.checkedNote}>
              No invite yet for this email.
            </Text>
          ) : null}
          <ActionButton
            title="Check again"
            style={styles.fill}
            onPress={() => setChecked(!checkForInvite())}
          />
          <ActionButton
            title="Sign in with another email"
            variant="secondary"
            style={styles.fill}
            onPress={() => {
              signOut().catch(() =>
                Alert.alert('Unable to sign out', 'Please try again.'),
              );
            }}
          />
        </View>
        <Text style={styles.footnote}>
          Inspections and repair requests unlock once you're linked to a unit.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title={`Hi, ${first}`}
        subtitle={`${unit.street} • Unit ${unit.unit}`}
        right={bell}
      />

      {!details?.baselineRecordedOn ? (
        <View style={[styles.moveIn, styles.moveInWaiting]}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>MOVE-IN</Text>
          </View>
          <Text style={styles.moveInTitle}>Move-in baseline coming soon</Text>
          <Text style={styles.moveInBody}>
            {`${
              unit.landlordName.split(' ')[0]
            } hasn't recorded it yet. You'll be able to review it here once it's ready.`}
          </Text>
        </View>
      ) : !baselineReviewed ? (
        <View style={styles.moveIn}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>MOVE-IN</Text>
          </View>
          <Text style={styles.moveInTitle}>Review your move-in baseline</Text>
          <Text style={styles.moveInBody}>
            {`${unit.landlordName.split(' ')[0]} photographed ${
              details.areas.length
            } areas on ${
              details.baselineRecordedOn
            }. Check they match what you see. You can add your own photos for your records.`}
          </Text>
          <ActionButton
            title="Review baseline"
            compact
            style={styles.moveInButton}
            onPress={() => navigation.navigate('TenantBaseline')}
          />
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Report issue"
          onPress={() => navigation.navigate('ReportMaintenance')}
          style={({ pressed }) => [
            styles.card,
            styles.action,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.actionIcon, styles.orange]}>
            <Text style={styles.bang}>!</Text>
          </View>
          <Text style={styles.actionTitle}>Report issue</Text>
          <Text style={styles.actionDetail}>Photo or video</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Availability"
          onPress={() => navigation.navigate('InspectionAvailability')}
          style={({ pressed }) => [
            styles.card,
            styles.action,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.actionIcon, styles.purple]}>
            <CalendarIcon />
          </View>
          <Text style={styles.actionTitle}>Availability</Text>
          <Text style={styles.actionDetail}>For in-person visits</Text>
        </Pressable>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Recent activity</Text>
        {recent ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View unit history"
            onPress={() => navigation.navigate('History')}
            hitSlop={8}
          >
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        ) : null}
      </View>
      {baselineReviewed ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('TenantBaseline')}
          style={({ pressed }) => [
            styles.card,
            styles.activity,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.activityTitle}>Move-in baseline reviewed</Text>
          <Text style={styles.actionDetail}>
            {ownPhotoCount > 0
              ? `You added ${ownPhotoCount} photo${
                  ownPhotoCount === 1 ? '' : 's'
                } for your records`
              : 'Tap to see the baseline photos again'}
          </Text>
        </Pressable>
      ) : null}
      {recent ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            navigation.navigate('MaintenanceDetail', {
              requestId: recent.requestId,
            })
          }
          style={({ pressed }) => [
            styles.card,
            styles.activity,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.activityTitle}>{recent.title}</Text>
          <Text style={styles.actionDetail}>
            {recent.status} • {recent.update}
          </Text>
        </Pressable>
      ) : baselineReviewed ? null : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.actionDetail}>
            Inspections and repair requests will show up here.
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    gap: 18,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
  },
  pressed: { opacity: 0.8 },
  moveIn: {
    gap: 6,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.brand,
    backgroundColor: colors.white,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.brandTint,
  },
  tagText: {
    fontSize: 11,
    fontWeight: typography.bold,
    letterSpacing: 0.3,
    color: colors.brand,
  },
  moveInWaiting: { borderWidth: 1, borderColor: colors.cardBorder },
  moveInTitle: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: typography.bold,
    color: colors.ink,
  },
  moveInBody: { fontSize: 13, lineHeight: 19, color: colors.muted },
  moveInButton: { marginTop: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: typography.bold,
    color: colors.ink,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAll: {
    fontSize: 13,
    fontWeight: typography.semibold,
    color: colors.brand,
  },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1, gap: 4, padding: 14 },
  actionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  orange: { backgroundColor: '#FFF2DE' },
  purple: { backgroundColor: '#F2EBFF' },
  bang: { fontSize: 14, fontWeight: typography.bold, color: '#E58212' },
  actionTitle: {
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  actionDetail: { fontSize: 12, lineHeight: 17, color: colors.muted },
  activity: { gap: 4, paddingVertical: 14, paddingHorizontal: 16 },
  activityTitle: {
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  empty: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: typography.medium,
    color: colors.ink,
  },
  waiting: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  mail: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.warnBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: typography.bold,
    color: colors.ink,
  },
  waitingBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.muted,
  },
  email: { fontSize: 15, fontWeight: typography.semibold, color: colors.ink },
  checkedNote: { fontSize: 13, color: colors.warnText },
  fill: { alignSelf: 'stretch' },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.muted,
  },
});
