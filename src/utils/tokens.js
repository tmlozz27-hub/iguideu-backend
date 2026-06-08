import jwt from "jsonwebtoken";
import crypto from "crypto";

export function createAccessToken(payload, expiresIn = process.env.JWT_EXPIRES_IN || "7d") {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}
export function createRefreshToken(payload, expiresIn = process.env.JWT_REFRESH_EXPIRES || "7d") {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn });
}
export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}
export function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
