import "server-only";
import { createHash, randomBytes } from "node:crypto";

export const createAccessToken = (): string => randomBytes(32).toString("base64url");

export const hashAccessToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
