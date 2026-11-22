import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import Icon from '../../components/Icon';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { useTenantDemo } from '../../context/TenantDemoContext';
import type { TenantStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { weekdayDay } from '../../utils/dates';

type Props = NativeStackScreenProps<TenantStackParamList, 'TenantPickTime'>;

export default function TenantPickTimeScreen({ navigation }: Props) {
  const { inspection, details, unit, sendAvailability, declineTimes } =
    useTenantDemo();
  const [chosen, setChosen] = useState<string[]>(inspection?.tenantSlots ?? []);
  if (!inspection?.slots || !details || !unit) return null;
  const landlordFirst = details.landlordName.split(' ')[0];

  function toggle(id: string) {
    setChosen(current =>
      current.includes(id) ? current.filter(c => c !== id) : [...current, id],
    );
  }

  function noneWork() {
    Alert.alert(
      'None of these work?',
      `${landlordFirst} will be asked to propose new times.`,
      [
        { text: 'Go back', style: 'cancel' },
        {
          text: 'Tell them',
          onPress: () => {
            declineTimes();
            navigation.goBack();
          },
        },
      ],
    );
  }

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle title="Pick a time" onBack={() => navigation.goBack()} />
      <Text style={styles.intro}>
        {`${landlordFirst} wants to inspect Unit ${unit.unit} in person. Choose every time that works for you.`}
      </Text>
      {inspection.slots.map(slot => {
        const on = chosen.includes(slot.id);
        return (
          <Pressable
            key={slot.id}
            accessibilityRole="checkbox"
            accessibilityLabel={`${weekdayDay(slot.date)}, ${slot.time}`}
            accessibilityState={{ checked: on }}
            onPress={() => toggle(slot.id)}
            style={[styles.slot, on && styles.slotOn]}
          >
            <View style={[styles.box, on && styles.boxOn]}>
              {on ? (
                <Icon
                  name="check"
                  size={14}
                  color={colors.white}
                  strokeWidth={3}
                />
              ) : null}
            </View>
            <View style={styles.flex}>
              <Text style={styles.day}>{weekdayDay(slot.date)}</Text>
              <Text style={styles.time}>{slot.time}</Text>
            </View>
          </Pressable>
        );
      })}
      <Text style={styles.count}>
        {`${chosen.length} time${chosen.length === 1 ? '' : 's'} selected`}
      </Text>
      <ActionButton
        title="Send availability"
        disabled={chosen.length === 0}
        onPress={() => {
          sendAvailability(chosen);
          navigation.goBack();
        }}
      />
      <ActionButton
        title="None of these work"
        variant="link"
        onPress={noneWork}
      />
      <Text style={styles.footnote}>
        {`${landlordFirst} confirms one time and you'll get a notification.`}
      </Text>
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
  slotOn: {
    borderWidth: 1.5,
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
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
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  flex: { flex: 1, gap: 2 },
  day: { fontSize: 15, fontWeight: typography.semibold, color: colors.ink },
  time: { fontSize: 13, color: colors.muted },
  count: { fontSize: 13, color: colors.muted },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.muted,
  },
});
