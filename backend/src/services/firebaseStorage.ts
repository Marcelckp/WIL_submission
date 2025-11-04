import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getStorage, Storage } from "firebase-admin/storage";

let firebaseApp: App | undefined;
let storage: Storage | undefined;

// Initialize Firebase Admin SDK
function initializeFirebase(): void {
  if (getApps().length > 0) {
    firebaseApp = getApps()[0];
    storage = getStorage(firebaseApp);
    return;
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (!serviceAccount || !storageBucket) {
    console.warn(
      "Firebase Storage not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY and FIREBASE_STORAGE_BUCKET to enable storage."
    );
    return;
  }

  try {
    const serviceAccountJson = JSON.parse(serviceAccount);
    firebaseApp = initializeApp({
      credential: cert(serviceAccountJson),
      storageBucket: storageBucket,
    });
    storage = getStorage(firebaseApp);
    console.log("Firebase Storage initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Firebase Storage:", error);
  }
}

// Initialize on module load
initializeFirebase();

function getBucket() {
  if (!storage || !firebaseApp) {
    throw new Error("Firebase Storage not initialized");
  }
  return storage.bucket();
}

/**
 * Upload a file to Firebase Cloud Storage
 * @param folder - Folder/bucket path (e.g., "invoices", "media", "boq")
 * @param fileName - File name including path (e.g., "invoices/company123/invoice.pdf")
 * @param data - File data as Buffer
 * @param contentType - MIME type (e.g., "application/pdf")
 * @returns Public URL of the uploaded file
 */
export async function uploadBlob(
  folder: string,
  fileName: string,
  data: Buffer,
  contentType?: string
): Promise<string> {
  const bucket = getBucket();
  const fullPath = `${folder}/${fileName}`;
  const file = bucket.file(fullPath);

  const stream = file.createWriteStream({
    metadata: {
      contentType: contentType || "application/octet-stream",
    },
    public: true, // Make file publicly accessible
  });

  return new Promise((resolve, reject) => {
    stream.on("error", (error) => {
      reject(error);
    });

    stream.on("finish", async () => {
      try {
        // Make file publicly accessible
        await file.makePublic();
        // Get public URL
        const url = `https://storage.googleapis.com/${bucket.name}/${fullPath}`;
        resolve(url);
      } catch (error) {
        reject(error);
      }
    });

    stream.end(data);
  });
}

/**
 * Delete a file from Firebase Cloud Storage
 */
export async function deleteBlob(
  folder: string,
  fileName: string
): Promise<void> {
  const bucket = getBucket();
  const fullPath = `${folder}/${fileName}`;
  const file = bucket.file(fullPath);
  await file.delete().catch((error: any) => {
    // Ignore if file doesn't exist
    if (error.code !== 404) {
      throw error;
    }
  });
}

/**
 * Download a file from Firebase Cloud Storage
 */
export async function downloadBlob(
  folder: string,
  fileName: string
): Promise<Buffer> {
  const bucket = getBucket();
  const fullPath = `${folder}/${fileName}`;
  const file = bucket.file(fullPath);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error("File not found");
  }

  const [buffer] = await file.download();
  return buffer;
}

/**
 * Stream a file from Firebase Cloud Storage
 */
export async function streamBlob(
  folder: string,
  fileName: string
): Promise<NodeJS.ReadableStream> {
  const bucket = getBucket();
  const fullPath = `${folder}/${fileName}`;
  const file = bucket.file(fullPath);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error("File not found");
  }

  return file.createReadStream();
}

/**
 * Get a signed URL for a file (for temporary access)
 */
export async function getSignedUrl(
  folder: string,
  fileName: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const bucket = getBucket();
  const fullPath = `${folder}/${fileName}`;
  const file = bucket.file(fullPath);

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInSeconds * 1000,
  });

  return url;
}
