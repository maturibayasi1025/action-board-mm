type JwtPayload = Record<string, unknown>;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textToBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

export function isJwtShape(token: string): boolean {
  const parts = token.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

export async function signHs256Jwt(
  payload: JwtPayload,
  secret: string,
): Promise<string> {
  const header = toBase64Url(
    textToBytes(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  );
  const body = toBase64Url(textToBytes(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const key = await hmacKey(secret);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, textToBytes(data)),
  );
  return `${data}.${toBase64Url(signature)}`;
}

export async function verifyHs256Jwt<T extends JwtPayload>(
  token: string,
  secret: string,
): Promise<T | null> {
  if (!isJwtShape(token)) {
    return null;
  }
  const [header, body, signature] = token.split(".");
  const data = `${header}.${body}`;
  const key = await hmacKey(secret);
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, textToBytes(data)),
  );
  const actual = fromBase64Url(signature);
  if (!equalBytes(expected, actual)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body)),
    ) as T;
    const exp = payload.exp;
    if (typeof exp === "number" && exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textToBytes(value));
  return toBase64Url(new Uint8Array(digest));
}
