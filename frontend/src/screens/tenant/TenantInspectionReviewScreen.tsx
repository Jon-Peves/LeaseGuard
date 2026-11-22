import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import PhotoTile from '../../components/PhotoTile';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { useTenantDemo } from '../../context/TenantDemoContext';
import type { TenantStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<
  TenantStackParamList,
  'TenantInspectionReview'
>;

export default function TenantInspectionReviewScreen({ navigation }: Props) {
  const { inspection, submitInspection } = useTenantDemo();
  if (!inspection) return null;
  const done = inspection.areas.filter(a => inspection.photos[a]).length;
  const complete = done === inspection.areas.length;

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="Review your photos"
        subtitle={`Routine inspection • ${done} of ${inspection.areas.length} areas done`}
        onBack={() => navigation.goBack()}
      />
      <View style={styles.grid}>
        {inspection.areas.map((area, index) => (
          <PhotoTile
            key={area}
            area={area}
            uri={inspection.photos[area]}
            placeholder={inspection.photos[area] ? 'PHOTO' : 'MISSING'}
            retakeLabel={inspection.photos[area] ? 'Retake' : 'Take photo'}
            onRetake={() =>
              navigation.navigate('TenantInspectionCapture', {
                step: index,
                retake: true,
              })
            }
          />
        ))}
      </View>
      <Text style={styles.note}>Once you submit, photos can't be changed.</Text>
      <ActionButton
        title="Submit inspection"
        disabled={!complete}
        onPress={() => {
          submitInspection();
          navigation.navigate('TenantInspectionDone');
        }}
      />
      {!complete ? (
        <Text style={styles.note}>Take a photo of every area to submit.</Text>
      ) : null}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  note: { fontSize: 12, lineHeight: 17, color: colors.muted },
});
