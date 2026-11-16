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
import { capturePhoto } from '../../utils/capturePhoto';

type Props = NativeStackScreenProps<TenantStackParamList, 'TenantMovePhotos'>;

export default function TenantMovePhotosScreen({ navigation, route }: Props) {
  const { step } = route.params;
  const { details, movePhotos, setMovePhoto, markBaselineReviewed } =
    useTenantDemo();
  const [busy, setBusy] = useState(false);
  if (!details) return null;
  const area = details.areas[step];
  const total = details.areas.length;
  const landlordFirst = details.landlordName.split(' ')[0];

  function finish() {
    markBaselineReviewed();
    navigation.popTo('TenantTabs');
  }

  function next() {
    if (step + 1 >= total) finish();
    else navigation.push('TenantMovePhotos', { step: step + 1 });
  }

  async function capture() {
    if (busy) return;
    setBusy(true);
    const uri = await capturePhoto();
    setBusy(false);
    if (!uri) return;
    setMovePhoto(area, uri);
    next();
  }

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="Your move-in photos"
        subtitle={`Step ${step + 1} of ${total} • ${area}`}
      />
      <ProgressBar value={(step + 1) / total} />
      <View style={styles.card}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>FOR YOUR RECORDS</Text>
        </View>
        <Text style={styles.body}>
          {`Capture anything the baseline missed, like a scuff or stain. These are saved to your unit history and don't change ${landlordFirst}'s baseline.`}
        </Text>
      </View>
      <CameraFrame uri={movePhotos[area]} />
      <ActionButton
        title={busy ? 'Opening camera…' : 'Capture photo'}
        disabled={busy}
        onPress={capture}
      />
      <View style={styles.row}>
        <ActionButton
          title="Skip this area"
          variant="secondary"
          compact
          style={styles.half}
          onPress={next}
        />
        <ActionButton
          title="Finish later"
          variant="secondary"
          compact
          style={styles.half}
          onPress={() => navigation.popTo('TenantTabs')}
        />
      </View>
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
  card: {
    gap: 8,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.divider,
  },
  tagText: {
    fontSize: 11,
    fontWeight: typography.bold,
    letterSpacing: 0.3,
    color: colors.brandSoftText,
  },
  body: { fontSize: 13, lineHeight: 19, color: colors.muted },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
