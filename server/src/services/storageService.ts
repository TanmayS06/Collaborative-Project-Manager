import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads folder exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface StoredFile {
  fileName: string;
  fileKey: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
}

/**
 * Object Storage Service:
 * Simulates Cloud Object Storage (e.g. AWS S3) locally with static serving,
 * while preserving identical interface and signed URL metadata patterns.
 */
export const storeUploadedFile = async (
  file: Express.Multer.File,
  baseUrl: string
): Promise<StoredFile> => {
  const fileKey = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const targetPath = path.join(UPLOADS_DIR, fileKey);

  // Write file buffer to storage
  await fs.promises.writeFile(targetPath, file.buffer);

  const fileUrl = `${baseUrl}/uploads/${fileKey}`;

  return {
    fileName: file.originalname,
    fileKey,
    fileUrl,
    fileSize: file.size,
    fileType: file.mimetype,
  };
};

export const deleteStoredFile = async (fileKey: string): Promise<void> => {
  try {
    const targetPath = path.join(UPLOADS_DIR, fileKey);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
  } catch (err) {
    console.warn(`[Storage Warning] Failed to delete file "${fileKey}":`, (err as Error).message);
  }
};
