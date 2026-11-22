import { Image, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import Field from '../../components/Field';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { useTenantDemo } from '../../context/TenantDemoContext';
import { shortDate } from '../../data/demoStore';
import type { TenantStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Props = NativeStackScreenProps<
  TenantStackParamList,
  'TenantInspectionPhoto'
>;

function Panel({
  uri,
  label,
  caption,
}: {
  uri?: string;
  label: string;
  caption: string;
}) {
  return (
    <View style={styles.panel}>
      <View style={[styles.photo, label === 'BASELINE' && styles.baseline]}>
        {uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityLabel={`${label.toLowerCase()} photo`}
          />
        ) : (
          <Text style={styles.photoLabel}>{label}</Text>
        )}
      </View>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

export default function TenantInspectionPhotoScreen({
  navigation,
  route,
}: Props) {
  const { step, retake } = route.params;
  const { inspection, details, setInspectionNote } = useTenantDemo();
  if (!inspection || !details) return null;
  const area = inspection.areas[step];
  const total = inspection.areas.length;

  function acceptPhoto() {
    if (retake) {
      navigation.popTo('TenantInspectionReview');
    } else if (step + 1 >= total) {
      navigation.navigate('TenantInspectionReview');
    } else {
      navigation.push('TenantInspectionCapture', { step: step + 1 });
    }
  }

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="Review photo"
        subtitle={`Step ${step + 1} of ${total} • ${area}`}
      />
      <View style={styles.compare}>
        <Panel
          uri={details.baselinePhotos[area]}
          label="BASELINE"
          caption={`Baseline • ${details.baselineRecordedOn ?? ''}`}
        />
        <Panel
          uri={inspection.photos[area]}
          label="YOUR PHOTO"
          caption={`Today • ${shortDate()}`}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Same view as your baseline?</Text>
        <Text style={styles.cardBody}>
          If the angle or distance is off, retake it so the comparison stays
          fair.
        </Text>
      </View>
      <Field
        label="Anything to point out? (optional)"
        hint="For example: the faucet started dripping last week."
        value={inspection.notes?.[area] ?? ''}
        onChangeText={text => setInspectionNote(area, text)}
        maxLength={300}
        multiline
      />
      <ActionButton title="Use this photo" onPress={acceptPhoto} />
      <ActionButton
        title="Retake"
        variant="secondary"
        onPress={() => navigation.goBack()}
      />
      <Text style={styles.footnote}>
        {`You'll review all ${total} photos before you submit.`}
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    gap: 16,
  },
  compare: { flexDirection: 'row', gap: 12 },
  panel: { flex: 1, gap: 8 },
  photo: {
    height: 230,
    borderRadius: 16,
    backgroundColor: '#CDD6E2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  baseline: { backgroundColor: '#E0E7EF' },
  photoLabel: {
    fontSize: 12,
    fontWeight: typography.semibold,
    letterSpacing: 0.5,
    color: colors.brandSoftText,
  },
  caption: { fontSize: 12, color: colors.muted },
  card: {
    gap: 4,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  cardBody: { fontSize: 13, lineHeight: 19, color: colors.muted },
  footnote: { fontSize: 12, textAlign: 'center', color: colors.muted },
});
