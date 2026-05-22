import { Paths, File, Directory } from 'expo-file-system';

let PHOTOS_DIR: Directory | null = null;

function getPhotosDir(): Directory {
  if (!PHOTOS_DIR) {
    PHOTOS_DIR = new Directory(Paths.document, 'photos');
  }
  return PHOTOS_DIR;
}

async function ensurePhotosDir(): Promise<void> {
  try {
    const dir = getPhotosDir();
    if (!dir.exists) {
      dir.create({ intermediates: true });
    }
  } catch {}
}

export async function moveToPermanent(tempUri: string, momentId: string): Promise<string> {
  try {
    const dir = getPhotosDir();
    await ensurePhotosDir();
    const ext = tempUri.endsWith('.jpg') ? '.jpg' : '.png';
    const destFile = new File(dir, momentId + ext);
    const tempFile = new File(tempUri);
    try { tempFile.move(destFile); } catch { return tempUri; }
    return destFile.uri;
  } catch { return tempUri; }
}

export async function deletePhotoFile(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {}
}

export async function savePhotoFromPicker(assetUri: string, momentId: string): Promise<string> {
  try {
    const dir = getPhotosDir();
    await ensurePhotosDir();
    const destFile = new File(dir, momentId + '.jpg');
    const srcFile = new File(assetUri);
    try { srcFile.copy(destFile); } catch { return assetUri; }
    return destFile.uri;
  } catch { return assetUri; }
}

export function getPhotosDirUri(): string {
  return getPhotosDir()?.uri ?? '';
}

export async function getStorageStats(): Promise<{ photoCount: number; totalSizeMB: number }> {
  try {
    const dir = getPhotosDir();
    await ensurePhotosDir();
    const files = dir.list();
    let totalSize = 0;
    for (const f of files) {
      if (f instanceof File && f.exists) {
        totalSize += f.size ?? 0;
      }
    }
    return {
      photoCount: files.length,
      totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 10) / 10,
    };
  } catch {
    return { photoCount: 0, totalSizeMB: 0 };
  }
}
