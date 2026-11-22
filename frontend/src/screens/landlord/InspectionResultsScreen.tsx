import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { firstName, useLandlordDemo } from '../../context/LandlordDemoContext';
import { currentInspection, type AreaResult } from '../../data/demoStore';
import type { LandlordStackParamList } from '../../navigation/types';
import { LEASE_API_ENABLED } from '../../services/leaseConfig';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Props = NativeStackScreenProps<
  LandlordStackParamList,
  'InspectionResults'
>;

type Compared = Exclude<AreaResult, { error: string }>;

const isCompared = (result?: AreaResult): result is Compared =>
  Boolean(result) && !('error' in (result as object));

// A photo is "verified" when Gemini says it is clear and shows the same spot
// as the move-in baseline, so the comparison can be trusted.
export function photoCheck(result: Compared) {
  if (result.photo_quality === 'good' && result.same_area) {
    return { ok: true, label: 'Photo verified' };
  }
  const reason =
    result.photo_quality === 'too_dark'
      ? 'too dark'
      : result.photo_quality === 'blurry'
      ? 'blurry'
      : "doesn't match the move-in area";
  return { ok: false, label: `Retake needed • ${reason}` };
}

export function verdict(result: Compared) {
  if (!photoCheck(result).ok) return 'Not compared';
  if (result.classification === 'damage') {
    return `Possible damage${result.severity ? ` • ${result.severity}` : ''}`;
  }
  return result.classification === 'normal_wear' ? 'Normal wear' : 'No change';
}

export default function InspectionResultsScreen({ navigation, route }: Props) {
  const { propertyId, unitId } = route.params;
  const { findUnit, rerunReview } = useLandlordDemo();
  const found = findUnit(propertyId, unitId);
  const inspection = found ? currentInspection(found.unit) : undefined;
  if (!found || !inspection) return null;
  const { property, unit } = found;
  const who = firstName(unit.tenant);
  const ai = inspection.ai;
  const results = ai?.results ?? {};
  const compared = Object.values(results).filter(isCompared);
  const verified = compared.filter(r => photoCheck(r).ok);
  const damage = verified.filter(r => r.classification === 'damage');

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="AI review"
        subtitle={`${property.street} • Unit ${unit.name}`}
        onBack={() => navigation.goBack()}
      />

      {!ai || ai.status === 'pending' ? (
        <View style={styles.banner}>
          {ai ? <ActivityIndicator color={colors.brand} /> : null}
          <Text style={styles.bannerText}>
            {ai
              ? `Comparing ${who}'s photos with the move-in baseline. This usually takes under a minute.`
              : 'The AI review runs on the LeaseGuard server once the tenant submits.'}
          </Text>
        </View>
      ) : (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>
            {damage.length
              ? `${damage.length} area${
                  damage.length === 1 ? '' : 's'
                } may have damage`
              : ai.status === 'error'
              ? 'The AI review could not run'
              : 'No damage found'}
          </Text>
          <Text style={styles.summaryBody}>
            {`${verified.length} of ${inspection.areas.length} photos verified • submitted ${inspection.submittedOn}`}
          </Text>
        </View>
      )}

      {inspection.areas.map(area => {
        const result = results[area];
        const check = isCompared(result) ? photoCheck(result) : null;
        return (
          <View key={area} style={styles.card} accessibilityLabel={area}>
            <Text style={styles.area}>{area}</Text>
            <View style={styles.photos}>
              <Photo label="Move-in" uri={unit.baselinePhotos?.[area]} />
              <Photo label="Now" uri={inspection.photos[area]} />
            </View>
            {unit.baselineNotes?.[area] ? (
              <Text style={styles.note}>
                {`Your move-in note: ${unit.baselineNotes[area]}`}
              </Text>
            ) : null}
            {inspection.notes?.[area] ? (
              <Text style={styles.tenantNote}>
                {`${who}'s note: “${inspection.notes[area]}”`}
              </Text>
            ) : null}
            {check ? (
              <Text style={[styles.pill, check.ok ? styles.ok : styles.warn]}>
                {check.label}
              </Text>
            ) : null}
            {isCompared(result) ? (
              <>
                <Text style={styles.verdict}>
                  {`${verdict(result)} • ${result.confidence} confidence`}
                </Text>
                <Text style={styles.body}>{result.summary}</Text>
                {result.findings.map((finding, index) => (
                  <Text key={index} style={styles.finding}>
                    {`• ${finding.description}${
                      finding.pre_existing_worsened
                        ? ' (worse than move-in)'
                        : ''
                    }`}
                  </Text>
                ))}
                {result.obstructed_areas ? (
                  <Text style={styles.note}>
                    {`Couldn't check: ${result.obstructed_areas}`}
                  </Text>
                ) : null}
              </>
            ) : result ? (
              <Text style={styles.note}>{result.error}</Text>
            ) : null}
          </View>
        );
      })}

      <Text style={styles.footnote}>
        AI flags possible issues. You and your tenant make the final call.
      </Text>
      {LEASE_API_ENABLED && ai && ai.status !== 'pending' ? (
        <ActionButton
          title="Run AI review again"
          variant="secondary"
          onPress={() => rerunReview(propertyId, unitId)}
        />
      ) : null}
    </ScreenContainer>
  );
}

function Photo({ label, uri }: { label: string; uri?: string }) {
  return (
    <View style={styles.photoWrap}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.photo}
          accessibilityLabel={`${label} photo`}
        />
      ) : (
        <View style={[styles.photo, styles.empty]}>
          <Text style={styles.emptyText}>No photo</Text>
        </View>
      )}
      <Text style={styles.photoLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
  },
  bannerText: { flex: 1, color: colors.brandSoftText, fontSize: 14 },
  summary: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 4,
  },
  summaryTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: typography.bold,
  },
  summaryBody: { color: colors.muted, fontSize: 14 },
  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  area: { color: colors.ink, fontSize: 16, fontWeight: typography.semibold },
  photos: { flexDirection: 'row', gap: 10 },
  photoWrap: { flex: 1, gap: 4 },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    backgroundColor: colors.divider,
  },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.muted, fontSize: 12 },
  photoLabel: { color: colors.muted, fontSize: 12 },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: typography.semibold,
    overflow: 'hidden',
  },
  ok: { backgroundColor: colors.successTint, color: colors.successText },
  warn: { backgroundColor: colors.warnBg, color: colors.warnText },
  verdict: { color: colors.ink, fontSize: 15, fontWeight: typography.semibold },
  body: { color: colors.label, fontSize: 14, lineHeight: 20 },
  finding: { color: colors.label, fontSize: 14, lineHeight: 20 },
  note: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
  tenantNote: {
    color: colors.brandSoftText,
    fontSize: 13,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.brandSoft,
  },
  footnote: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
