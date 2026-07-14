import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "default_super_stable_supplygrid_secret_key";

export function signJwt(payload: any): string {
  const header = { alg: "HS256", typ: "JWT" };
  const base64UrlHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const base64UrlPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${base64UrlHeader}.${base64UrlPayload}`)
    .digest("base64url");
  return `${base64UrlHeader}.${base64UrlPayload}.${signature}`;
}

export function verifyJwt(token: string): any {
  try {
    const [headerB64, payloadB64, signature] = token.split(".");
    if (!headerB64 || !payloadB64 || !signature) return null;
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    return payload;
  } catch (err) {
    return null;
  }
}
