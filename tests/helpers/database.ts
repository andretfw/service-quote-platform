import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
export async function testDatabase() {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
    );
    for (const file of (await readdir("supabase/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort())
      await db.exec(
        (await readFile(`supabase/migrations/${file}`, "utf8")).replace(
          "create extension if not exists pgcrypto;",
          "",
        ),
      );
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
