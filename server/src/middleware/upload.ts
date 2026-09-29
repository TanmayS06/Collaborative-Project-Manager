import multer from 'multer';

// Store files in memory buffer before writing to object storage / filesystem
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Allow documents, images, diagrams, archives, and code files
    cb(null, true);
  },
});
