// Every photo upload in the app goes through here. The server stores the file
// in Cloudinary and saves its URL with the unit, area and kind in MongoDB.
import { API_BASE_URL, ApiError } from './api';
import { csrfToken } from './leaseService';

export type PhotoKind = 'baseline' | 'move_in' | 'inspection';

export type PhotoTarget = {
  kind: PhotoKind;
  unitId: string;
  area: string;
  inspectionId?: string;
};

const UPLOAD_TIMEOUT_MS = 60000;

export async function uploadPhoto(
  uri: string,
  target: PhotoTarget,
): Promise<string> {
  const form = new FormData();
  // React Native's FormData accepts a file descriptor object for local URIs.
  form.append('file', {
    uri,
    name: `${target.kind}.jpg`,
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('kind', target.kind);
  form.append('unitId', target.unitId);
  form.append('area', target.area);
  if (target.inspectionId) {
    form.append('inspectionId', target.inspectionId);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/photos/`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      signal: controller.signal,
      headers: { Accept: 'application/json', 'X-CSRFToken': await csrfToken() },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || typeof data?.url !== 'string') {
      throw new ApiError(
        typeof data?.detail === 'string'
          ? data.detail
          : 'The photo did not upload. Please try again.',
        response.status,
      );
    }
    return data.url;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      controller.signal.aborted
        ? 'The upload timed out. Check your connection and try again.'
        : 'Unable to reach LeaseGuard. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timer);
  }
}
