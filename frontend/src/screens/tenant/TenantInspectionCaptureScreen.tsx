import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import CameraFrame from '../../components/CameraFrame';
import ProgressBar from '../../components/ProgressBar';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { useTenantDemo } from '../../context/TenantDemoContext';
import type { TenantStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { TENANT_LIBRARY_FOR_TESTING } from '../../services/leaseConfig';
import { capturePhoto, choosePhoto } from '../../utils/capturePhoto';

type Props = NativeStackScreenProps<
  TenantStackParamList,
  'TenantInspectionCapture'
>;

export default function TenantInspectionCaptureScreen({
  navigation,
  route,
}: Props) {
  const { step, retake } = route.params;
  const { inspection, details, setInspectionPhoto } = useTenantDemo();
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState(true);
  if (!inspection || !details) return null;
  const area = inspection.areas[step];
  const total = inspection.areas.length;
  const existing = inspection.photos[area];
  const baselineUri = details.baselinePhotos[area];
  const baselineDate = details.baselineRecordedOn ?? '';

  async function capture(source: 'camera' | 'library' = 'camera') {
    if (busy) return;
    setBusy(true);
    const uri = await (source === 'library' ? choosePhoto() : capturePhoto());
    setBusy(false);
    if (!uri) return;
    setInspectionPhoto(area, uri);
    navigation.push('TenantInspectionPhoto', { step, retake });
  }

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="Routine inspection"
        subtitle={`Step ${step + 1} of ${total} • ${area}`}
        onBack={retake ? () => navigation.goBack() : undefined}
      />
      <ProgressBar value={(step + 1) / total} />
      <View style={styles.tip}>
        <Text style={styles.tipTitle}>Line up with your baseline photo</Text>
        <Text style={styles.tipBody}>
          {`The faint image is the move-in baseline from ${baselineDate}. Stand in the same spot and match it as closely as you can.`}
        </Text>
        <Text style={styles.tipBody}>
          <Text style={styles.bold}>Small scratch or mark?</Text> Take a
          close-up too.
        </Text>
      </View>
      <CameraFrame
        uri={existing && !overlay ? existing : undefined}
        overlayUri={overlay ? baselineUri : undefined}
        overlayLabel={
          overlay && !baselineUri
            ? `BASELINE OVERLAY • ${baselineDate.toUpperCase()}`
            : undefined
        }
        badge={overlay ? 'Overlay on' : 'Overlay off'}
        onBadgePress={() => setOverlay(v => !v)}
      />
      <ActionButton
        title={
          busy ? 'Opening camera…' : existing ? 'Retake photo' : 'Capture photo'
        }
        disabled={busy}
        onPress={() => capture('camera')}
      />
      {TENANT_LIBRARY_FOR_TESTING ? (
        <ActionButton
          title="Test only: choose from library"
          variant="secondary"
          disabled={busy}
          onPress={() => capture('library')}
        />
      ) : null}
      {retake ? null : (
        <ActionButton
          title="Save & finish later"
          variant="secondary"
          onPress={() => navigation.popTo('TenantTabs')}
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
  bold: { fontWeight: typography.semibold, color: colors.ink },
});
