import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import PhotoTile from '../../components/PhotoTile';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { firstName, useLandlordDemo } from '../../context/LandlordDemoContext';
import type { LandlordStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<LandlordStackParamList, 'ReviewBaseline'>;

export default function ReviewBaselineScreen({ navigation, route }: Props) {
  const { propertyId, unitId } = route.params;
  const { findUnit, saveBaseline } = useLandlordDemo();
  const found = findUnit(propertyId, unitId);
  if (!found) return null;
  const { unit } = found;
  const photos = unit.baselinePhotos ?? {};
  const done = unit.areas.filter(a => photos[a]).length;
  const complete = done === unit.areas.length;
  const who = unit.tenant ? firstName(unit.tenant) : 'your tenant';

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="Review baseline"
        subtitle={`Unit ${unit.name} • ${done} of ${unit.areas.length} areas done`}
        onBack={() => navigation.goBack()}
      />
      <View style={styles.grid}>
        {unit.areas.map((area, index) => (
          <PhotoTile
            key={area}
            area={area}
            uri={photos[area]}
            placeholder={photos[area] ? 'PHOTO' : 'MISSING'}
            retakeLabel={photos[area] ? 'Retake' : 'Take photo'}
            onRetake={() =>
              navigation.navigate('BaselineCapture', {
                propertyId,
                unitId,
                step: index,
                retake: true,
              })
            }
          />
        ))}
      </View>
      <Text style={styles.note}>
        {`Every inspection is compared against these photos, and ${who} can see them once they join.`}
      </Text>
      <ActionButton
        title="Save baseline"
        disabled={!complete}
        onPress={() => {
          saveBaseline(propertyId, unitId);
          navigation.popTo('Dashboard');
        }}
      />
      {!complete ? (
        <Text style={styles.note}>Take a photo of every area to save.</Text>
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
