import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import Field from '../../components/Field';
import CameraFrame from '../../components/CameraFrame';
import ProgressBar from '../../components/ProgressBar';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { useLandlordDemo } from '../../context/LandlordDemoContext';
import type { LandlordStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { capturePhoto, choosePhoto } from '../../utils/capturePhoto';

type Props = NativeStackScreenProps<LandlordStackParamList, 'BaselineCapture'>;

export default function BaselineCaptureScreen({ navigation, route }: Props) {
  const { propertyId, unitId, step, retake } = route.params;
  const { findUnit, setBaselinePhoto, setBaselineNote, renameArea } =
    useLandlordDemo();
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const found = findUnit(propertyId, unitId);
  if (!found) return null;
  const { unit } = found;
  const area = unit.areas[step];
  const total = unit.areas.length;
  const existing = unit.baselinePhotos?.[area];
  const nameTaken = unit.areas.some(
    a => a !== area && a.toLowerCase() === newName.trim().toLowerCase(),
  );

  function saveName() {
    if (!newName.trim() || nameTaken) return;
    renameArea(propertyId, unitId, area, newName);
    setRenaming(false);
  }

  async function capture(source: 'camera' | 'library' = 'camera') {
    if (busy) return;
    setBusy(true);
    const uri = await (source === 'library' ? choosePhoto() : capturePhoto());
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
      {renaming ? (
        <View style={styles.rename}>
          <Field
            label="Area name"
            value={newName}
            onChangeText={setNewName}
            maxLength={60}
            autoFocus
            error={
              nameTaken ? 'Another area already has this name.' : undefined
            }
          />
          <View style={styles.renameRow}>
            <ActionButton
              title="Save name"
              compact
              disabled={!newName.trim() || nameTaken}
              onPress={saveName}
            />
            <ActionButton
              title="Cancel"
              compact
              variant="secondary"
              onPress={() => setRenaming(false)}
            />
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setNewName(area);
            setRenaming(true);
          }}
        >
          <Text style={styles.link}>{`Rename "${area}"`}</Text>
        </Pressable>
      )}
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
      <Field
        label="Move-in note (optional)"
        hint="Anything already worn or damaged here, like a scratch by the outlet."
        value={unit.baselineNotes?.[area] ?? ''}
        onChangeText={note => setBaselineNote(propertyId, unitId, area, note)}
        maxLength={300}
        multiline
      />
      <ActionButton
        title={busy ? 'Opening…' : existing ? 'Retake photo' : 'Capture photo'}
        disabled={busy}
        onPress={() => capture('camera')}
      />
      <ActionButton
        title="Choose from library"
        variant="secondary"
        disabled={busy}
        onPress={() => capture('library')}
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
  rename: { gap: 10 },
  renameRow: { flexDirection: 'row', gap: 10 },
  link: {
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.brand,
  },
});
