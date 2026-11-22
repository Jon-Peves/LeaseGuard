import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { firstName, useLandlordDemo } from '../../context/LandlordDemoContext';
import { currentInspection } from '../../data/demoStore';
import type { LandlordStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { slotLabel, weekdayDay } from '../../utils/dates';

type Props = NativeStackScreenProps<
  LandlordStackParamList,
  'ConfirmInspectionTime'
>;

export default function ConfirmInspectionTimeScreen({
  navigation,
  route,
}: Props) {
  const { propertyId, unitId } = route.params;
  const { findUnit, confirmInspectionTime, cancelInspection } =
    useLandlordDemo();
  const found = findUnit(propertyId, unitId);
  const inspection = found ? currentInspection(found.unit) : undefined;
  const available = inspection?.tenantSlots ?? [];
  const [choice, setChoice] = useState<string | undefined>(available[0]);
  if (!found || !inspection?.slots) return null;
  const { unit } = found;
  const who = firstName(unit.tenant);
  const declined = inspection.status === 'times-declined';
  const picked = inspection.slots.find(s => s.id === choice);

  function proposeNew() {
    cancelInspection(propertyId, unitId);
    navigation.replace('ScheduleInspection', { propertyId, unitId });
  }

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle title="Pick a time" onBack={() => navigation.goBack()} />
      <Text style={styles.intro}>
        {declined
          ? `In-person inspection • Unit ${unit.name}. None of your times work for ${who}.`
          : `In-person inspection • Unit ${unit.name}. ${who} can make ${available.length} of your ${inspection.slots.length} times.`}
      </Text>
      {inspection.slots.map(slot => {
        const can = available.includes(slot.id);
        const selected = slot.id === choice;
        return (
          <Pressable
            key={slot.id}
            accessibilityRole="radio"
            accessibilityLabel={`${weekdayDay(slot.date)}, ${slot.time}`}
            accessibilityState={{ checked: selected, disabled: !can }}
            disabled={!can}
            onPress={() => setChoice(slot.id)}
            style={[
              styles.slot,
              selected && styles.slotSelected,
              !can && styles.slotDisabled,
            ]}
          >
            <View style={[styles.radio, selected && styles.radioOn]}>
              {selected ? <View style={styles.dot} /> : null}
            </View>
            <View style={styles.flex}>
              <Text style={styles.day}>{weekdayDay(slot.date)}</Text>
              <Text style={styles.time}>{slot.time}</Text>
            </View>
            <Text style={[styles.can, can ? styles.canYes : styles.canNo]}>
              {can ? `${who} can` : `${who} can't`}
            </Text>
          </Pressable>
        );
      })}
      {picked ? (
        <ActionButton
          title={`Confirm ${slotLabel(picked)}`}
          onPress={() => {
            confirmInspectionTime(propertyId, unitId, picked.id);
            navigation.popTo('Dashboard');
          }}
        />
      ) : null}
      {picked ? (
        <Text style={styles.footnote}>
          {`${who} gets a confirmation and a reminder the day before.`}
        </Text>
      ) : null}
      <ActionButton
        title="Propose new times"
        variant={declined ? 'primary' : 'secondary'}
        onPress={proposeNew}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 14,
  },
  intro: { fontSize: 14, lineHeight: 20, color: colors.muted },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  slotSelected: {
    borderWidth: 1.5,
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  slotDisabled: { backgroundColor: '#F1F4F8', borderColor: colors.divider },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.brand },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  flex: { flex: 1, gap: 2 },
  day: { fontSize: 15, fontWeight: typography.semibold, color: colors.ink },
  time: { fontSize: 13, color: colors.muted },
  can: { fontSize: 12, fontWeight: typography.semibold },
  canYes: { color: colors.successText },
  canNo: { color: colors.muted },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.muted,
  },
});
