"""Cloudinary photo storage. CLOUDINARY_URL comes from the environment."""
import urllib.request

from django.conf import settings

ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'}
MAX_UPLOAD_BYTES = 15 * 1024 * 1024


class StorageError(Exception):
    pass


def upload_photo(file, folder):
    if not getattr(settings, 'CLOUDINARY_URL', ''):
        raise StorageError('Photo storage is not configured (CLOUDINARY_URL).')
    import cloudinary.uploader  # reads CLOUDINARY_URL from the environment

    try:
        result = cloudinary.uploader.upload(
            file, folder=folder, resource_type='image',
            # Phone photos are large; keep a sane max size and let Cloudinary pick the format.
            transformation=[{'width': 2000, 'height': 2000, 'crop': 'limit'}],
        )
    except Exception as error:
        raise StorageError(f'Upload failed: {error}') from error
    return result['secure_url'], result.get('public_id', '')


def download_photo(url):
    """Fetch a stored photo's bytes for the AI comparison (Cloudinary only)."""
    if not url.startswith('https://res.cloudinary.com/'):
        raise StorageError('Photo is not stored in Cloudinary.')
    with urllib.request.urlopen(url, timeout=30) as response:
        data = response.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise StorageError('Photo is too large.')
    return data
