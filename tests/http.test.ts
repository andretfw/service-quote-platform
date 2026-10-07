import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { parseJson, HttpError, assertSameOrigin } from "../lib/server/http";

test("streamed bodies stop at the byte limit without trusting Content-Length", async () => {
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"value":"' + "x".repeat(100)));
    },
    cancel() {
      canceled = true;
    },
  });
  const request = new Request("https://example.test", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(
    () => parseJson(request, z.object({ value: z.string() }), 20),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );
  assert.equal(canceled, true);
});

test("JSON parsing rejects malformed input and cross-origin authenticated mutations", async () => {
  await assert.rejects(
    () =>
      parseJson(new Request("https://example.test", { method: "POST", body: "{" }), z.object({})),
    (error: unknown) => error instanceof HttpError && error.status === 400,
  );
  assert.throws(
    () =>
      assertSameOrigin(
        new Request("https://example.test", { headers: { origin: "https://attacker.test" } }),
      ),
    HttpError,
  );
});
