import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import PhotoTile from '../../components/PhotoTile';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { useTenantDemo } from '../../context/TenantDemoContext';
import type { TenantStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Props = NativeStackScreenProps<TenantStackParamList, 'TenantBaseline'>;

export default function TenantBaselineScreen({ navigation }: Props) {
  const { details, markBaselineReviewed } = useTenantDemo();
  if (!details) return null;
  const landlordFirst = details.landlordName.split(' ')[0];

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="Move-in baseline"
        subtitle={`Recorded by ${details.landlordName} • ${details.baselineRecordedOn}`}
        onBack={() => navigation.goBack()}
      />
      <Text style={styles.intro}>
        These are the photos future inspections are compared against. Check they
        match how your unit looks.
      </Text>
      <View style={styles.grid}>
        {details.areas.map(area => (
          <PhotoTile
            key={area}
            area={area}
            uri={details.baselinePhotos[area]}
            placeholder="BASELINE"
          />
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>See something that isn't shown?</Text>
        <Text style={styles.cardBody}>
          {`Add your own photos. They're saved to your unit history and don't replace ${landlordFirst}'s baseline.`}
        </Text>
      </View>
      <ActionButton
        title="Add my own photos"
        onPress={() => navigation.navigate('TenantMovePhotos', { step: 0 })}
      />
      <ActionButton
        title="Looks right"
        variant="secondary"
        onPress={() => {
          markBaselineReviewed();
          navigation.goBack();
        }}
      />
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
  intro: { fontSize: 14, lineHeight: 20, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    gap: 4,
    padding: 14,
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
});
