import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import Field from '../../components/Field';
import Icon from '../../components/Icon';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import {
  firstName,
  useLandlordDemo,
  type Property,
} from '../../context/LandlordDemoContext';
import { currentInspection, makeId } from '../../data/demoStore';
import type { LandlordStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { daysFromToday, shortDay, weekdayDay } from '../../utils/dates';
import { inspectionDateError } from '../../utils/landlordValidation';

type Props = NativeStackScreenProps<
  LandlordStackParamList,
  'ScheduleInspection'
>;
type Kind = 'remote' | 'inperson';
type Slot = { id: string; date: string; time: string };

const suggestedSlots = (): Slot[] => [
  { id: makeId('slot'), date: daysFromToday(4), time: '6–8 PM' },
  { id: makeId('slot'), date: daysFromToday(5), time: '5–7 PM' },
  { id: makeId('slot'), date: daysFromToday(6), time: '10 AM–1 PM' },
];

export function schedulableUnits(properties: Property[]) {
  return properties.flatMap(property =>
    property.units
      .filter(unit => {
        const current = currentInspection(unit);
        return (
          unit.tenant?.status === 'joined' &&
          unit.baselineRecordedOn &&
          (!current || current.status === 'submitted')
        );
      })
      .map(unit => ({ property, unit })),
  );
}

function Check({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.box, checked && styles.boxChecked]}>
      {checked ? (
        <Icon name="check" size={14} color={colors.white} strokeWidth={3} />
      ) : null}
    </View>
  );
}

export default function ScheduleInspectionScreen({ navigation, route }: Props) {
  const { properties, scheduleInspection } = useLandlordDemo();
  const options = useMemo(() => schedulableUnits(properties), [properties]);
  const [target, setTarget] = useState(() => {
    const wanted = route.params;
    return (
      options.find(
        o =>
          o.property.id === wanted?.propertyId && o.unit.id === wanted?.unitId,
      ) ?? options[0]
    );
  });
  const [kind, setKind] = useState<Kind>('remote');
  const [dueDate, setDueDate] = useState(daysFromToday(7));
  const [selected, setSelected] = useState<string[]>(target?.unit.areas ?? []);
  const [slots, setSlots] = useState<Slot[]>(suggestedSlots);
  const [editAreas, setEditAreas] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!target) {
    return (
      <ScreenContainer style={styles.content}>
        <ScreenTitle
          title="Schedule inspection"
          onBack={() => navigation.goBack()}
        />
        <Text style={styles.note}>
          Inspections open up once a tenant has joined and the move-in baseline
          is saved.
        </Text>
      </ScreenContainer>
    );
  }

  const { property, unit } = target;
  const tenantFirst = firstName(unit.tenant);
  const chipLabel = `${property.street} • Unit ${unit.name} • ${unit.tenant?.name}`;
  const errors = {
    dueDate: kind === 'remote' ? inspectionDateError(dueDate) : undefined,
    areas: selected.length === 0 ? 'Pick at least one area.' : undefined,
    slots:
      kind === 'inperson' && slots.length === 0
        ? 'Add at least one time.'
        : undefined,
  };
  const show = (error?: string) => (submitted ? error : undefined);

  function pickUnit() {
    if (options.length < 2) return;
    Alert.alert(
      'Choose a unit',
      undefined,
      options.slice(0, 3).map(option => ({
        text: `${option.property.street} • Unit ${option.unit.name}`,
        onPress: () => {
          setTarget(option);
          setSelected(option.unit.areas);
        },
      })),
    );
  }

  function toggleArea(area: string) {
    setSelected(current =>
      current.includes(area)
        ? current.filter(a => a !== area)
        : unit.areas.filter(a => a === area || current.includes(a)),
    );
  }

  function addSlot() {
    const dateError = inspectionDateError(newDate.trim());
    if (dateError || !newTime.trim()) {
      Alert.alert(
        'Add a time',
        dateError ?? 'Enter a time window, like 6–8 PM.',
      );
      return;
    }
    setSlots(current => [
      ...current,
      { id: makeId('slot'), date: newDate.trim(), time: newTime.trim() },
    ]);
    setNewDate('');
    setNewTime('');
  }

  function submit() {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    scheduleInspection(
      property.id,
      unit.id,
      kind === 'remote'
        ? { kind, dueDate, areas: selected }
        : { kind, areas: selected, slots },
    );
    navigation.popTo('Dashboard');
  }

  const areaList = (
    <View style={styles.card}>
      {unit.areas.map((area, index) => (
        <Pressable
          key={area}
          accessibilityRole="checkbox"
          accessibilityLabel={area}
          accessibilityState={{ checked: selected.includes(area) }}
          onPress={() => toggleArea(area)}
          style={[styles.row, index < unit.areas.length - 1 && styles.divider]}
        >
          <Check checked={selected.includes(area)} />
          <Text style={styles.rowText}>{area}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="Schedule inspection"
        onBack={() => navigation.goBack()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Unit, ${chipLabel}`}
        onPress={pickUnit}
        style={styles.chip}
      >
        <Text numberOfLines={1} style={styles.chipText}>
          {chipLabel}
        </Text>
        {options.length > 1 ? <Text style={styles.chevron}>⌄</Text> : null}
      </Pressable>

      <View style={styles.group}>
        <Text style={styles.label}>Inspection type</Text>
        <View style={styles.types}>
          {(
            [
              ['remote', 'Remote photo', `${tenantFirst} submits photos`],
              ['inperson', 'In person', 'You propose times'],
            ] as const
          ).map(([id, title, detail]) => (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityLabel={title}
              accessibilityState={{ checked: kind === id }}
              onPress={() => setKind(id)}
              style={[styles.type, kind === id && styles.typeSelected]}
            >
              <Text style={[styles.typeTitle, kind === id && styles.brandText]}>
                {title}
              </Text>
              <Text style={styles.typeDetail}>{detail}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {kind === 'remote' ? (
        <>
          <Field
            label="Due date"
            placeholder="YYYY-MM-DD"
            value={dueDate}
            onChangeText={setDueDate}
            error={show(errors.dueDate)}
            hint={
              inspectionDateError(dueDate) ? undefined : weekdayDay(dueDate)
            }
          />
          <View style={styles.group}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Areas to inspect</Text>
              <Text style={styles.count}>
                {`${selected.length} of ${unit.areas.length} selected`}
              </Text>
            </View>
            {areaList}
            {show(errors.areas) ? (
              <Text style={styles.error}>{errors.areas}</Text>
            ) : null}
          </View>
          <ActionButton
            title={`Schedule & notify ${tenantFirst}`}
            onPress={submit}
          />
          <Text style={styles.footnote}>
            {inspectionDateError(dueDate)
              ? `${tenantFirst} gets a reminder before the due date.`
              : `${tenantFirst} gets a reminder to submit photos by ${shortDay(
                  dueDate,
                )}.`}
          </Text>
        </>
      ) : (
        <>
          <View style={styles.group}>
            <Text style={styles.label}>Times you can do it</Text>
            {slots.length ? (
              <View style={styles.card}>
                {slots.map((slot, index) => (
                  <View
                    key={slot.id}
                    style={[
                      styles.row,
                      index < slots.length - 1 && styles.divider,
                    ]}
                  >
                    <Text style={styles.rowText}>
                      <Text style={styles.slotDay}>
                        {weekdayDay(slot.date)}
                      </Text>
                      {` • ${slot.time}`}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${weekdayDay(slot.date)}`}
                      onPress={() =>
                        setSlots(current =>
                          current.filter(s => s.id !== slot.id),
                        )
                      }
                      hitSlop={8}
                    >
                      <Icon name="close" size={16} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            {show(errors.slots) ? (
              <Text style={styles.error}>{errors.slots}</Text>
            ) : null}
            <View style={styles.addRow}>
              <Field
                label="Date"
                placeholder="YYYY-MM-DD"
                value={newDate}
                onChangeText={setNewDate}
                containerStyle={styles.flex}
              />
              <Field
                label="Time"
                placeholder="6–8 PM"
                value={newTime}
                onChangeText={setNewTime}
                containerStyle={styles.flex}
              />
            </View>
            <Pressable accessibilityRole="button" onPress={addSlot}>
              <Text style={styles.link}>+ Add a time</Text>
            </Pressable>
          </View>

          <View style={[styles.card, styles.areasSummary]}>
            <View style={styles.flex}>
              <Text style={styles.rowText}>Areas to inspect</Text>
              <Text style={styles.count}>
                {selected.length === unit.areas.length
                  ? `All ${unit.areas.length} areas`
                  : `${selected.length} of ${unit.areas.length} areas`}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit areas"
              onPress={() => setEditAreas(v => !v)}
            >
              <Text style={styles.link}>{editAreas ? 'Done' : 'Edit'}</Text>
            </Pressable>
          </View>
          {editAreas ? areaList : null}
          {show(errors.areas) ? (
            <Text style={styles.error}>{errors.areas}</Text>
          ) : null}
          <ActionButton
            title={`Send times to ${tenantFirst}`}
            onPress={submit}
          />
          <Text style={styles.footnote}>
            {`${tenantFirst} picks the times that work. You confirm one.`}
          </Text>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 16,
  },
  flex: { flex: 1 },
  chip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  chipText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: typography.medium,
    color: colors.ink,
  },
  chevron: { fontSize: 14, color: colors.ink, marginTop: -4 },
  group: { gap: 8 },
  label: { fontSize: 13, fontWeight: typography.medium, color: colors.muted },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  count: { fontSize: 12, color: colors.muted },
  types: { flexDirection: 'row', gap: 12 },
  type: {
    flex: 1,
    gap: 2,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  typeSelected: {
    borderWidth: 1.5,
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  typeTitle: {
    fontSize: 15,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  brandText: { color: colors.brand },
  typeDetail: { fontSize: 12, color: colors.muted },
  card: {
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowText: { flex: 1, fontSize: 15, color: colors.ink },
  slotDay: { fontWeight: typography.semibold },
  box: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  addRow: { flexDirection: 'row', gap: 10 },
  link: {
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.brand,
  },
  areasSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  error: { fontSize: 12, color: colors.error },
  note: { fontSize: 14, lineHeight: 20, color: colors.muted },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.muted,
  },
});
