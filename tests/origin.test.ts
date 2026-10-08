import assert from "node:assert/strict";
import test from "node:test";
import { HttpError, assertSameOrigin } from "../lib/server/http";

test("origin checks use the configured public URL behind hosting proxies", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://service-quote-platform.netlify.app";
  try {
    assert.doesNotThrow(() =>
      assertSameOrigin(
        new Request("http://internal:3000/api/auth/magic-link", {
          headers: { origin: "https://service-quote-platform.netlify.app" },
        }),
      ),
    );
    for (const origin of [
      "https://attacker.test",
      "http://service-quote-platform.netlify.app",
      "https://service-quote-platform.netlify.app.attacker.test",
    ]) {
      assert.throws(
        () =>
          assertSameOrigin(
            new Request("http://internal:3000/api/auth/magic-link", {
              headers: { origin, "x-forwarded-host": "attacker.test" },
            }),
          ),
        (error: unknown) => error instanceof HttpError && error.status === 403,
      );
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});

test("preview requests and auth redirects use only the deployment's exact build-time origin", async () => {
  const { getAppUrl } = await import("../lib/server/env");
  const previous = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SERVICE_QUOTE_DEPLOYMENT_ORIGIN: process.env.SERVICE_QUOTE_DEPLOYMENT_ORIGIN,
  };
  const preview = "https://deploy-preview-5--service-quote-platform.netlify.app";
  process.env.NEXT_PUBLIC_APP_URL = "https://service-quote-platform.netlify.app";
  process.env.SERVICE_QUOTE_DEPLOYMENT_ORIGIN = preview;
  try {
    assert.equal(getAppUrl("http://internal:3000"), preview);
    assert.doesNotThrow(() =>
      assertSameOrigin(
        new Request("http://internal:3000/api/auth/magic-link", { headers: { origin: preview } }),
      ),
    );
    for (const origin of [
      "https://service-quote-platform.netlify.app",
      "https://deploy-preview-6--service-quote-platform.netlify.app",
      `${preview}.attacker.test`,
      "https://attacker.test",
    ]) {
      assert.throws(
        () =>
          assertSameOrigin(
            new Request("http://internal:3000/api/auth/magic-link", {
              headers: { origin, host: "attacker.test", "x-forwarded-host": "attacker.test" },
            }),
          ),
        (error: unknown) => error instanceof HttpError && error.status === 403,
      );
    }
    delete process.env.SERVICE_QUOTE_DEPLOYMENT_ORIGIN;
    assert.throws(
      () =>
        assertSameOrigin(
          new Request("http://internal:3000/api/auth/magic-link", { headers: { origin: preview } }),
        ),
      (error: unknown) => error instanceof HttpError && error.status === 403,
    );
    assert.equal(getAppUrl(preview), "https://service-quote-platform.netlify.app");
    process.env.SERVICE_QUOTE_DEPLOYMENT_ORIGIN = "https://user:password@attacker.test";
    assert.throws(() => getAppUrl(preview), /Invalid application URL/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
