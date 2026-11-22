import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import Icon from '../../components/Icon';
import ScreenContainer from '../../components/ScreenContainer';
import { useTenantDemo } from '../../context/TenantDemoContext';
import type { TenantStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Props = NativeStackScreenProps<
  TenantStackParamList,
  'TenantInspectionDone'
>;

export default function TenantInspectionDoneScreen({ navigation }: Props) {
  const { inspection, details, unit } = useTenantDemo();
  if (!inspection || !details || !unit) return null;
  const done = inspection.areas.filter(a => inspection.photos[a]).length;
  const rows = [
    ['Inspection', `Routine • Unit ${unit.unit}`],
    ['Areas', `${done} of ${inspection.areas.length} documented`],
    ['Submitted', inspection.submittedOn ?? ''],
  ];

  return (
    <ScreenContainer style={styles.content}>
      <View style={styles.top}>
        <View style={styles.check}>
          <Icon
            name="check"
            size={36}
            color={colors.successText}
            strokeWidth={2.5}
          />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          Inspection submitted
        </Text>
        <Text style={styles.subtitle}>
          {`${
            details.landlordName.split(' ')[0]
          } gets a notification once the AI comparison is ready.`}
        </Text>
        <View style={styles.card}>
          {rows.map(([label, value], index) => (
            <View
              key={label}
              style={[styles.row, index < rows.length - 1 && styles.divider]}
            >
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
        </View>
      </View>
      <ActionButton
        title="Back to home"
        onPress={() => navigation.popTo('TenantTabs')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 32,
    gap: 24,
  },
  top: { alignItems: 'center', gap: 10 },
  check: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: typography.bold,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.muted,
  },
  card: {
    alignSelf: 'stretch',
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  label: { fontSize: 13, color: colors.muted },
  value: { fontSize: 14, fontWeight: typography.medium, color: colors.ink },
});
