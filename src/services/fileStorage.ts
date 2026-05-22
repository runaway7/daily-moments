import { Paths, File, Directory } from 'expo-file-system';

let PHOTOS_DIR: Directory | null = null;
let initError = false;

function getPhotosDir(): Directory {
  if (!PHOTOS_DIR) {
    try {
      PHOTOS_DIR = new Directory(Paths.document, 'photos');
      initError = false;
    } catch {
      initError = true;
      PHOTOS_DIR = null;
    }
  }
  return PHOTOS_DIR!;
}

function ensurePhotosDir(): void {
  const dir = getPhotosDir();
  if (!dir || initError) return;
  try {
    if (!dir.exists) {
      dir.create({ intermediates: true });
    }
  } catch {}
}

export async function moveToPermanent(tempUri: string, momentId: string): Promise<string> {
  const dir = getPhotosDir();
  if (!dir || initError) return tempUri;
  ensurePhotosDir();
  const ext = tempUri.endsWith('.jpg') ? '.jpg' : '.png';
  const destFile = new File(dir, momentId + ext);
  const tempFile = new File(tempUri);
  try {
    if (destFile.exists) destFile.delete();
    tempFile.move(destFile);
  } catch { return tempUri; }
  return destFile.uri;
}

export async function deletePhotoFile(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // file may already be gone
  }
}

export async function savePhotoFromPicker(assetUri: string, momentId: string): Promise<string> {
  const dir = getPhotosDir();
  if (!dir || initError) return assetUri;
  ensurePhotosDir();
  const destFile = new File(dir, momentId + '.jpg');
  const srcFile = new File(assetUri);
  try {
    if (destFile.exists) destFile.delete();
    srcFile.copy(destFile);
  } catch { return assetUri; }
  return destFile.uri;
}

export function getPhotosDirUri(): string {
  const dir = getPhotosDir();
  return dir?.uri ?? '';
}

export async function getStorageStats(): Promise<{ photoCount: number; totalSizeMB: number }> {
  const dir = getPhotosDir();
  if (!dir || initError) return { photoCount: 0, totalSizeMB: 0 };
  ensurePhotosDir();
  try {
    const files = dir.list();
    let totalSize = 0;
    for (const f of files) {
      if (f instanceof File) {
        if (f.exists) {
          totalSize += f.size ?? 0;
        }
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
