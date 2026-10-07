import "server-only";
import sharp from "sharp";
import { HttpError } from "./http";

const prefix = "data:image/png;base64,";
const endMarker = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export async function normalizeLogo(value: string | undefined): Promise<string | undefined> {
  if (!value) return undefined;
  try {
    if (!value.startsWith(prefix) || value.length > 90000) throw new Error("Invalid encoding");
    const encoded = value.slice(prefix.length);
    const input = Buffer.from(encoded, "base64");
    if (
      input.length > 65536 ||
      input.toString("base64") !== encoded ||
      !input.subarray(0, 8).equals(signature) ||
      !input.subarray(-12).equals(endMarker)
    )
      throw new Error("Invalid PNG");
    const image = sharp(input, { limitInputPixels: 32768, failOn: "warning" });
    const metadata = await image.metadata();
    if (
      metadata.format !== "png" ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 256 ||
      metadata.height > 128 ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error("Invalid dimensions");
    const output = await image.png().toBuffer();
    if (output.length > 65536) throw new Error("Image too large");
    return prefix + output.toString("base64");
  } catch {
    throw new HttpError(
      400,
      "Invalid logo. Upload a PNG, JPEG or WebP image using the logo picker.",
    );
  }
}
