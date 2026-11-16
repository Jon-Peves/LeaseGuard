import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import Icon from '../../components/Icon';
import NotificationBell from '../../components/NotificationBell';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import Toast from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import {
  firstName,
  useLandlordDemo,
  type Property,
  type Unit,
} from '../../context/LandlordDemoContext';
import type { LandlordStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Props = NativeStackScreenProps<LandlordStackParamList, 'Dashboard'>;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  return hour < 17 ? 'Good afternoon' : 'Good evening';
}

function plural(count: number, word: string, many = `${word}s`) {
  return `${count} ${count === 1 ? word : many}`;
}

function unitSummary(unit: Unit) {
  const tenant = unit.tenant;
  if (!tenant) {
    return {
      headline: `Unit ${unit.name}`,
      detail: 'No tenant yet',
      pill: { label: 'VACANT', style: 'neutral' as const },
    };
  }
  if (tenant.status === 'pending') {
    return {
      headline: `Unit ${unit.name} • ${tenant.email}`,
      detail: `Invite sent ${tenant.invitedOn} • Waiting for tenant to register`,
      pill: { label: 'PENDING', style: 'warn' as const },
    };
  }
  if (tenant.status === 'declined') {
    return {
      headline: `Unit ${unit.name} • ${tenant.email}`,
      detail: `Declined ${tenant.declinedOn} • Check the email or invite someone else`,
      pill: { label: 'DECLINED', style: 'danger' as const },
    };
  }
  const baseline = unit.baselineRecordedOn
    ? ` • Baseline recorded ${unit.baselineRecordedOn}`
    : '';
  return {
    headline: `Unit ${unit.name} • ${tenant.name}`,
    detail: `Joined ${tenant.joinedOn}${baseline}`,
    pill: { label: 'JOINED', style: 'brand' as const },
  };
}

export default function LandlordDashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { properties, activity, toast, dismissToast, advanceDemo } =
    useLandlordDemo();
  const name = user?.name?.trim().split(' ')[0] || user?.email || 'there';
  const units = properties.flatMap(property =>
    property.units.map(unit => ({ property, unit })),
  );
  const needsBaseline = units.find(({ unit }) => !unit.baselineRecordedOn);
  const canSchedule =
    !needsBaseline &&
    units.some(({ unit }) => unit.tenant?.status === 'joined');
  const demoTarget = units.find(
    ({ unit }) => unit.tenant?.status === 'pending',
  );

  const openUnit = (property: Property, unit: Unit) =>
    navigation.navigate('EditUnit', {
      propertyId: property.id,
      unitId: unit.id,
    });

  const bell = (
    <NotificationBell
      unreadCount={activity.length}
      onPress={() => navigation.navigate('Notifications')}
    />
  );

  return (
    <View style={styles.screen}>
      <ScreenContainer style={styles.content}>
        {properties.length === 0 ? (
          <>
            <ScreenTitle
              title={`Welcome, ${name}`}
              subtitle="No properties yet"
              right={bell}
            />
            <View style={[styles.card, styles.emptyCard]}>
              <View style={styles.emptyIcon}>
                <Icon name="home" size={24} color={colors.brand} />
              </View>
              <Text style={styles.emptyTitle}>Add your first property</Text>
              <Text style={styles.emptyBody}>
                Add a property and its units, then invite your tenant by email
                to start tracking condition.
              </Text>
              <ActionButton
                title="+ Add property"
                onPress={() => navigation.navigate('AddProperty')}
                style={styles.emptyButton}
              />
            </View>
            <Text style={styles.sectionTitle}>How it works</Text>
            <View style={[styles.card, styles.steps]}>
              {[
                'Add the property and its units',
                'Invite your tenant by email',
                'Record the move-in baseline',
              ].map((step, index) => (
                <View
                  key={step}
                  style={[styles.step, index < 2 && styles.divider]}
                >
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <ScreenTitle
              title={`${greeting()}, ${name}`}
              subtitle={`${plural(units.length, 'unit')} • ${plural(
                properties.length,
                'property',
                'properties',
              )}`}
              right={bell}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Properties</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('AddProperty')}
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.addButtonText}>+ Add property</Text>
              </Pressable>
            </View>

            {properties.map(property => (
              <View key={property.id} style={[styles.card, styles.property]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${property.street}`}
                  onPress={() => openUnit(property, property.units[0])}
                  style={styles.propertyHeader}
                >
                  <View style={styles.flex}>
                    <Text style={styles.propertyName}>{property.street}</Text>
                    <Text style={styles.meta}>
                      {[property.city, plural(property.units.length, 'unit')]
                        .filter(Boolean)
                        .join(' • ')}
                    </Text>
                  </View>
                  <Icon name="chevron" size={18} color={colors.muted} />
                </Pressable>
                {property.units.map(unit => {
                  const summary = unitSummary(unit);
                  return (
                    <Pressable
                      key={unit.id}
                      accessibilityRole="button"
                      onPress={() => openUnit(property, unit)}
                      style={styles.unitRow}
                    >
                      <View style={styles.flex}>
                        <Text numberOfLines={1} style={styles.unitHeadline}>
                          {summary.headline}
                        </Text>
                        <Text style={styles.meta}>{summary.detail}</Text>
                      </View>
                      <View
                        style={[styles.pill, pillStyles[summary.pill.style]]}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            pillTextStyles[summary.pill.style],
                          ]}
                        >
                          {summary.pill.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            {needsBaseline ? (
              <View style={styles.nextCard}>
                <Text style={styles.nextTitle}>
                  Next: record the move-in baseline
                </Text>
                <Text style={styles.nextBody}>
                  Photograph each area before{' '}
                  {needsBaseline.unit.tenant
                    ? firstName(needsBaseline.unit.tenant)
                    : 'your tenant'}{' '}
                  moves in. Every inspection is compared against these photos.
                </Text>
                <ActionButton
                  title="Record baseline"
                  compact
                  style={styles.nextButton}
                  onPress={() =>
                    navigation.navigate('MoveInTour', {
                      propertyId: needsBaseline.property.id,
                      unitId: needsBaseline.unit.id,
                    })
                  }
                />
              </View>
            ) : null}

            {canSchedule ? (
              <ActionButton
                title="Schedule inspection"
                onPress={() => navigation.navigate('ScheduleInspection')}
              />
            ) : null}

            {activity.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                {activity.map(item => (
                  <View key={item.id} style={[styles.card, styles.activity]}>
                    <View style={styles.activityIcon}>
                      <Icon
                        name="check"
                        size={16}
                        color={colors.successText}
                        strokeWidth={2.5}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.activityTitle}>{item.title}</Text>
                      <Text style={styles.meta}>{item.detail}</Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}

            {demoTarget ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  advanceDemo(demoTarget.property.id, demoTarget.unit.id)
                }
                style={styles.demo}
              >
                <Text style={styles.demoText}>
                  {`Demo: simulate ${firstName(
                    demoTarget.unit.tenant,
                  )} joining`}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScreenContainer>

      {toast ? (
        <Toast
          title={toast.title}
          detail={toast.detail}
          onDismiss={dismissToast}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 96,
    gap: 18,
  },
  flex: { flex: 1, minWidth: 0, gap: 3 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: typography.bold,
    color: colors.ink,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.muted,
  },
  emptyButton: { marginTop: 10, alignSelf: 'stretch' },
  steps: { paddingVertical: 4, paddingHorizontal: 16 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: typography.bold,
    color: colors.brand,
  },
  stepText: { fontSize: 14, color: colors.ink },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: typography.bold,
    color: colors.ink,
  },
  addButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: typography.semibold,
    color: colors.brand,
  },
  pressed: { opacity: 0.7 },
  property: { paddingHorizontal: 16, paddingBottom: 14 },
  propertyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  propertyName: {
    fontSize: 16,
    fontWeight: typography.bold,
    color: colors.ink,
  },
  meta: { fontSize: 12, lineHeight: 16, color: colors.muted },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
  },
  unitHeadline: {
    fontSize: 14,
    fontWeight: typography.medium,
    color: colors.ink,
  },
  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  pillText: {
    fontSize: 11,
    fontWeight: typography.bold,
    letterSpacing: 0.3,
  },
  nextCard: {
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  nextTitle: {
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  nextBody: { fontSize: 13, lineHeight: 19, color: colors.brandSoftText },
  nextButton: { marginTop: 8 },
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.successTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: typography.medium,
    color: colors.ink,
  },
  demo: { alignSelf: 'center', paddingVertical: 10 },
  demoText: {
    fontSize: 12,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
});

const pillStyles = StyleSheet.create({
  danger: { backgroundColor: '#FDECEC' },
  warn: { backgroundColor: colors.warnBg },
  brand: { backgroundColor: colors.brandTint },
  neutral: { backgroundColor: colors.divider },
});

const pillTextStyles = StyleSheet.create({
  danger: { color: colors.error },
  warn: { color: colors.warnText },
  brand: { color: colors.brand },
  neutral: { color: colors.muted },
});
