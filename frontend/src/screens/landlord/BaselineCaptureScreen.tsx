import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import CameraFrame from '../../components/CameraFrame';
import ProgressBar from '../../components/ProgressBar';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { useLandlordDemo } from '../../context/LandlordDemoContext';
import type { LandlordStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { capturePhoto } from '../../utils/capturePhoto';

type Props = NativeStackScreenProps<LandlordStackParamList, 'BaselineCapture'>;

export default function BaselineCaptureScreen({ navigation, route }: Props) {
  const { propertyId, unitId, step, retake } = route.params;
  const { findUnit, setBaselinePhoto } = useLandlordDemo();
  const [busy, setBusy] = useState(false);
  const found = findUnit(propertyId, unitId);
  if (!found) return null;
  const { unit } = found;
  const area = unit.areas[step];
  const total = unit.areas.length;
  const existing = unit.baselinePhotos?.[area];

  async function capture() {
    if (busy) return;
    setBusy(true);
    const uri = await capturePhoto();
    setBusy(false);
    if (!uri) return;
    setBaselinePhoto(propertyId, unitId, area, uri);
    if (retake) {
      navigation.goBack();
      return;
    }
    const next = unit.areas.findIndex(
      (a, i) => i > step && !unit.baselinePhotos?.[a],
    );
    if (next === -1) {
      navigation.navigate('ReviewBaseline', { propertyId, unitId });
    } else {
      navigation.push('BaselineCapture', { propertyId, unitId, step: next });
    }
  }

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="Move-in baseline"
        subtitle={`Step ${step + 1} of ${total} • ${area}`}
        onBack={retake ? () => navigation.goBack() : undefined}
      />
      <ProgressBar value={(step + 1) / total} />
      <View style={styles.tip}>
        <Text style={styles.tipTitle}>
          {`Get the whole ${area.toLowerCase()} in frame`}
        </Text>
        <Text style={styles.tipBody}>
          Stand back, hold your phone level, and turn on the lights. This photo
          becomes the unit's baseline.
        </Text>
      </View>
      <CameraFrame
        uri={existing}
        badge={existing ? undefined : 'No baseline yet'}
      />
      <ActionButton
        title={
          busy ? 'Opening camera…' : existing ? 'Retake photo' : 'Capture photo'
        }
        disabled={busy}
        onPress={capture}
      />
      {retake ? null : (
        <ActionButton
          title="Save & finish later"
          variant="secondary"
          onPress={() => navigation.popTo('Dashboard')}
        />
      )}
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
  tip: {
    gap: 6,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  tipBody: { fontSize: 13, lineHeight: 19, color: colors.brandSoftText },
});
