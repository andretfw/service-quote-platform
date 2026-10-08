import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import messages from "../lib/i18n/messages.json";
const files = [
  "components/PublicFrame.tsx",
  "components/Faq.tsx",
  "components/TemplateGallery.tsx",
  "components/ConnectionSettings.tsx",
  "components/PlanCards.tsx",
  "app/page.tsx",
  "app/pricing/page.tsx",
  "app/help/page.tsx",
  "app/templates/page.tsx",
  "app/integrations/page.tsx",
  "app/connections/page.tsx",
];
test("public pages, guides and connections have complete Spanish and Romanian wording", async () => {
  const dictionary = messages as Record<string, { es: string; ro: string }>;
  const excluded = new Set(["POST", "PUT", "UTC", "Unable to load connections"]);
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      await readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node: ts.Node) {
      if (ts.isJsxText(node) || ts.isStringLiteral(node)) {
        const text = node.text.replace(/\s+/g, " ").trim();
        if (text && (/^[A-Z]/.test(text) || text === "{count} templates") && !excluded.has(text)) {
          assert.ok(dictionary[text]?.es, `${file}: missing Spanish for ${text}`);
          assert.ok(dictionary[text]?.ro, `${file}: missing Romanian for ${text}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});
