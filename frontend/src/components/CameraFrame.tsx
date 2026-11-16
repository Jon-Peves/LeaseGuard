import { Image, StyleSheet, Text, View } from 'react-native';
import { typography } from '../theme/typography';

type Props = {
  uri?: string;
  badge?: string;
};

export default function CameraFrame({ uri, badge }: Props) {
  return (
    <View style={styles.frame}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityLabel="Captured photo"
        />
      ) : null}
      <View style={[styles.corner, styles.topLeft]} />
      <View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} />
      <View style={[styles.corner, styles.bottomRight]} />
      <View style={styles.footer}>
        <Text style={styles.label}>
          {uri ? 'Photo captured' : 'Camera preview'}
        </Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const CORNER = 30;
const styles = StyleSheet.create({
  frame: {
    height: 340,
    borderRadius: 18,
    backgroundColor: '#2A3342',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#FFFFFF',
  },
  topLeft: { top: 28, left: 24, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 28, right: 24, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: {
    bottom: 64,
    left: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 64,
    right: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontSize: 13, color: '#E2E8F0' },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: typography.semibold,
    color: '#FFFFFF',
  },
});
