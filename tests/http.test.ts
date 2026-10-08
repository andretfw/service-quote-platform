import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { parseJson, publicApiError, HttpError, assertSameOrigin } from "../lib/server/http";

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

test("database authorization and conflicts return useful client errors without leaking internal details", () => {
  assert.equal(
    publicApiError({ code: "42501", message: "private workspace identifier" }).status,
    404,
  );
  for (const code of ["23505", "40001", "P0001"])
    assert.equal(publicApiError({ code }).status, 409);
  for (const code of ["22023", "22P02"]) assert.equal(publicApiError({ code }).status, 400);
  assert.deepEqual(publicApiError({ code: "XX000", message: "private credentials" }), {
    status: 500,
    message: "Request could not be completed",
  });
});
