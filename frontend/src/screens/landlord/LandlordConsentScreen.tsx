import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ActionButton from '../../components/ActionButton';
import Icon from '../../components/Icon';
import ScreenContainer from '../../components/ScreenContainer';
import { useLandlordDemo } from '../../context/LandlordDemoContext';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Props = { onReadPolicy?: () => void };

const sections = [
  {
    title: "What you'll see",
    body: 'Photos and videos your tenant records for the unit, with the date and area each one covers.',
  },
  {
    title: 'Who can see it',
    body: 'Only you and the tenant of that unit.',
  },
  {
    title: 'How AI is used',
    body: "Photos are sent to Google Gemini to compare against the baseline. AI flags possible changes and suggests a severity. It's advisory. You make the final call.",
  },
  {
    title: 'Your responsibility',
    body: "Use tenant photos only to document the unit's condition, and don't share them outside LeaseGuard.",
  },
];

export default function LandlordConsentScreen({ onReadPolicy }: Props) {
  const { acceptConsent } = useLandlordDemo();
  const [agreed, setAgreed] = useState(false);

  return (
    <ScreenContainer style={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        Before you start
      </Text>
      <Text style={styles.intro}>
        LeaseGuard keeps a shared condition record for each unit you manage.
        Here is how tenant photos and videos are handled.
      </Text>

      <View style={styles.card}>
        {sections.map((section, index) => (
          <View
            key={section.title}
            style={[styles.row, index < sections.length - 1 && styles.divider]}
          >
            <Text style={styles.rowTitle}>{section.title}</Text>
            <Text style={styles.rowBody}>{section.body}</Text>
          </View>
        ))}
      </View>

      {onReadPolicy ? (
        <Pressable accessibilityRole="link" onPress={onReadPolicy}>
          <Text style={styles.link}>Read the full privacy policy</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="I agree to the privacy and consent policy."
        accessibilityState={{ checked: agreed }}
        onPress={() => setAgreed(value => !value)}
        style={styles.agree}
      >
        <View style={[styles.box, agreed && styles.boxChecked]}>
          {agreed ? (
            <Icon name="check" size={14} color={colors.white} strokeWidth={3} />
          ) : null}
        </View>
        <Text style={styles.agreeText}>
          I agree to the privacy and consent policy.
        </Text>
      </Pressable>

      <ActionButton
        title="Accept and continue"
        disabled={!agreed}
        onPress={acceptConsent}
        style={styles.accept}
      />
      <Text style={styles.footnote}>
        Camera, properties and tenant photos stay locked until you accept.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 32 },
  title: {
    fontSize: 28,
    fontWeight: typography.bold,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  intro: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  card: {
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  row: { paddingVertical: 14, gap: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowTitle: { fontSize: 14, fontWeight: typography.semibold, color: colors.ink },
  rowBody: { fontSize: 13, lineHeight: 18, color: colors.muted },
  link: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.brand,
  },
  agree: {
    marginTop: 18,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  boxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  agreeText: { flex: 1, fontSize: 14, color: colors.ink },
  accept: { marginTop: 14 },
  footnote: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.muted,
  },
});
