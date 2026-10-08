import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types";
import { leadExport } from "../lib/server/lead-export";

test("CSV export traverses server row caps without duplicates and preserves formula protection", async (t) => {
  const rows = Array.from({ length: 1207 }, (_, i) => ({
    id: String(9999 - i).padStart(36, "0"),
    lead_name: i === 0 ? '=IMPORTXML("https://example.test")' : `Client ${i}`,
    lead_email: "client@example.test",
    lead_phone: "+40123",
    status: "new",
    created_at: "2026-01-01T10:00:00+00:00",
    calculator_id: "owned-calculator",
    template_slug: "painting",
    answers: { area: 100, notes: 'quote, with "comma"' },
    quote: { low: 414, high: 486, currency: "USD", subtotal: 450 },
  }));
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    assert.equal(url.searchParams.get("calculator_id"), "in.(owned-calculator)");
    assert.equal(url.searchParams.get("order"), "created_at.desc,id.desc");
    assert.ok(url.searchParams.get("created_at")?.startsWith("lte."));
    assert.equal(url.searchParams.get("limit"), "500");
    const cursor = url.searchParams.get("or")?.match(/id.lt.([0-9]+)/)?.[1];
    const start = cursor ? rows.findIndex((row) => row.id === cursor) + 1 : 0;
    requests++;
    return Response.json(rows.slice(start, start + 200));
  });
  const db = createClient<Database>("https://database.example.test", "test", {
    auth: { persistSession: false },
  });
  const text = await new Response(
    await leadExport(db, ["owned-calculator"], new AbortController().signal),
  ).text();
  const lines = text.trimEnd().split("\r\n");
  assert.equal(lines.length, rows.length + 1);
  assert.equal(requests, 8);
  assert.equal(new Set(lines.slice(1).map((line) => line.split(",")[0])).size, rows.length);
  assert.ok(lines[1].includes("'=IMPORTXML"));
  assert.ok(lines[1].includes("'+40123"));
  assert.ok(lines[1].includes('"414","486","USD","450"'));
  assert.ok(lines[1].includes('""area"":100'));
  assert.ok(lines.at(-1)?.includes("Client 1206"));
});

test("CSV export reports provider failure rather than silently completing a partial file", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    if (calls === 1)
      return Response.json([
        {
          id: "1",
          lead_name: "Client",
          lead_email: null,
          lead_phone: null,
          status: "new",
          created_at: "2026-01-01T00:00:00Z",
        },
      ]);
    return Response.json({ message: "test unavailable", code: "XX000" }, { status: 503 });
  });
  const db = createClient<Database>("https://database.example.test", "test", {
    auth: { persistSession: false },
  });
  await assert.rejects(
    new Response(await leadExport(db, ["owned"], new AbortController().signal)).text(),
  );
});

test("empty workspace exports a header without loading another workspace", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected data access");
  });
  const db = createClient<Database>("https://database.example.test", "test", {
    auth: { persistSession: false },
  });
  const text = await new Response(await leadExport(db, [], new AbortController().signal)).text();
  assert.equal(
    text,
    '"ID","Name","Email","Phone","Status","Created","Calculator ID","Service","Estimate low","Estimate high","Currency","Subtotal","Answers JSON"\r\n',
  );
  assert.equal(mock.mock.callCount(), 0);
});
