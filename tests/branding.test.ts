import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { normalizeLogo } from "../lib/server/logo";
import { assertCalculatorFeatures } from "../lib/server/calculator-settings";
import { toPublicQuoteConfig } from "../lib/server/calculator-resolver";
import { getTemplate } from "../lib/templates";
import { quoteTemplateSchema } from "../lib/server/schemas";

const png = async (width = 128, height = 64) =>
  "data:image/png;base64," +
  (
    await sharp({
      create: { width, height, channels: 4, background: { r: 15, g: 60, b: 140, alpha: 0.5 } },
    })
      .png()
      .toBuffer()
  ).toString("base64");

test("logos are decoded and normalized to a bounded transparent PNG", async () => {
  const input = await png();
  const result = await normalizeLogo(input);
  assert.ok(result?.startsWith("data:image/png;base64,"));
  const metadata = await sharp(Buffer.from(result!.split(",")[1], "base64")).metadata();
  assert.equal(metadata.width, 128);
  assert.equal(metadata.height, 64);
  assert.equal(metadata.hasAlpha, true);
  assert.equal(await normalizeLogo(undefined), undefined);
  await assert.rejects(() => normalizeLogo("https://example.test/logo.png"));
  await assert.rejects(() => normalizeLogo("data:image/svg+xml;base64,PHN2Zy8+"));
  await assert.rejects(() => normalizeLogo("data:image/png;base64,aW52YWxpZA=="));
  await assert.rejects(() => normalizeLogo("data:image/png;base64," + "A".repeat(90000)));
  await assert.rejects(() => normalizeLogo(input.slice(0, -16)));
});

test("only Premium and Business can save or publicly display business branding", async () => {
  const template = structuredClone(getTemplate("painting")!);
  template.settings = { logoDataUrl: await png(), businessName: "Painter", accentColor: "#123456" };
  assert.equal(quoteTemplateSchema.safeParse(template).success, true);
  assert.throws(() => assertCalculatorFeatures(template, "basic"));
  for (const plan of ["premium", "business"] as const) {
    assert.doesNotThrow(() => assertCalculatorFeatures(template, plan));
    const config = toPublicQuoteConfig({
      publicId: "test",
      calculatorId: "calculator",
      template,
      plan,
    });
    assert.equal(config.logoDataUrl, template.settings.logoDataUrl);
    assert.equal(config.accentColor, "#123456");
  }
  for (const plan of ["basic", null] as const) {
    const config = toPublicQuoteConfig({
      publicId: "test",
      calculatorId: "calculator",
      template,
      plan,
    });
    assert.equal(config.logoDataUrl, undefined);
    assert.equal(config.businessName, undefined);
    assert.equal(config.accentColor, undefined);
  }
});

test("oversized logo dimensions and active content cannot be saved", async () => {
  const tooWide = await png(257, 64);
  await assert.rejects(() => normalizeLogo(tooWide));
  const tooTall = await png(128, 129);
  await assert.rejects(() => normalizeLogo(tooTall));
  const template = structuredClone(getTemplate("painting")!);
  template.settings = { logoDataUrl: "data:image/svg+xml;base64,PHN2Zy8+" };
  assert.equal(quoteTemplateSchema.safeParse(template).success, false);
});
