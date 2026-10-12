export const PASSWORD_MIN_LENGTH = 8;
const ITERATIONS = 310_000;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export async function hashPassword(password: string, salt = crypto.randomUUID()): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `${salt}.${toBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, expected] = stored.split(".");
  if (!salt || !expected) return false;
  const actual = await hashPassword(password, salt);
  return actual === `${salt}.${expected}`;
}