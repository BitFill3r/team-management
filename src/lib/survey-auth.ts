import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { NextRequest } from "next/server";

export const SURVEY_SECONDS = 12 * 60 * 60;
let warnedMissingIp = false;
function sign(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET muss mindestens 32 Zeichen haben.");
  return createHmac("sha256", secret).update(`survey:${value}`).digest("hex");
}
export const surveyCookie = (token: string) => `survey-${token}`;
export function createSurveySession(id: string, version: number, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + SURVEY_SECONDS}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${sign(`${id}:${version}:${payload}`)}`;
}
export function validSurveySession(token: string | undefined, id: string, version: number, now = Date.now()) {
  if (!token || !/^\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires, nonce, signature] = token.split(".");
  const remaining = Number(expires) - Math.floor(now / 1000);
  return remaining > 0 && remaining <= SURVEY_SECONDS &&
    timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(`${id}:${version}:${expires}.${nonce}`), "hex"));
}
export function surveyVisitor(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return sign("local-development");
  const netlifyOrigin = process.env.APP_ORIGIN && new URL(process.env.APP_ORIGIN).hostname.endsWith(".netlify.app");
  if (process.env.TRUST_NETLIFY_IP === "true" || process.env.NETLIFY === "true" || netlifyOrigin) {
    const ip = request.headers.get("x-nf-client-connection-ip");
    if (ip && isIP(ip)) return sign(`visitor:${ip}`);
  }
  // Fail closed to a shared bucket on unsupported hosts, never trust caller-supplied forwarding chains.
  if (!warnedMissingIp) {
    console.warn("Umfrage-Limit: Keine vertrauenswürdige Client-IP verfügbar; gemeinsames Besucherlimit aktiv.");
    warnedMissingIp = true;
  }
  return sign("shared-visitor");
}
