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
