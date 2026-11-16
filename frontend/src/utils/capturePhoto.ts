import { Alert } from 'react-native';
import { launchCamera } from 'react-native-image-picker';

export async function capturePhoto(): Promise<string | null> {
  try {
    const result = await launchCamera({
      mediaType: 'photo',
      cameraType: 'back',
      saveToPhotos: false,
      quality: 0.8,
    });
    if (result.didCancel) return null;
    if (result.errorCode) {
      Alert.alert(
        'Camera unavailable',
        result.errorCode === 'camera_unavailable'
          ? 'This device has no camera available.'
          : 'Allow camera access in your settings and try again.',
      );
      return null;
    }
    return result.assets?.[0]?.uri ?? null;
  } catch {
    Alert.alert('Camera unavailable', 'Unable to open the camera. Try again.');
    return null;
  }
}
