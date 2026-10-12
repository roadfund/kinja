import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Where uploaded files live: an S3-compatible bucket. Kinja never links to the bucket
// directly; /files/... checks who is asking, then redirects to a link that expires.
export interface ObjectStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  signedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

const runtime = globalThis as typeof globalThis & { __kinjaObjectStore?: ObjectStore | null; __kinjaTestObjectStore?: ObjectStore | null };

// Configured with AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
// and optionally S3_BUCKET (default "assets"). Without them (local development) uploads
// stay inside their records as data URLs.
export const objectStorageConfigured = () => Boolean(process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

export function getObjectStore(): ObjectStore | null {
  if (runtime.__kinjaTestObjectStore !== undefined) return runtime.__kinjaTestObjectStore;
  if (!objectStorageConfigured()) return null;
  if (!runtime.__kinjaObjectStore) {
    const bucket = process.env.S3_BUCKET || "assets";
    const s3 = new S3Client({ endpoint: process.env.AWS_ENDPOINT_URL_S3, region: process.env.AWS_REGION || "auto", forcePathStyle: true });
    runtime.__kinjaObjectStore = {
      put: async (key, body, contentType) => { await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })); },
      signedUrl: (key, expiresIn) => getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn }),
    };
  }
  return runtime.__kinjaObjectStore;
}

export function setObjectStoreForTesting(store: ObjectStore | null | undefined): void {
  runtime.__kinjaTestObjectStore = store;
}
