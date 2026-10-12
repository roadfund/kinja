let lastTimestamp = 0;
let sequence = 0;

export function createUuidV7(): string {
  const timestamp = Date.now();
  if (timestamp === lastTimestamp) sequence = (sequence + 1) & 0xfff;
  else sequence = 0;
  lastTimestamp = timestamp;

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[0] = timestamp / 2 ** 40;
  bytes[1] = timestamp / 2 ** 32;
  bytes[2] = timestamp / 2 ** 24;
  bytes[3] = timestamp / 2 ** 16;
  bytes[4] = timestamp / 2 ** 8;
  bytes[5] = timestamp;
  bytes[6] = 0x70 | (sequence >> 8);
  bytes[7] = sequence & 0xff;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}