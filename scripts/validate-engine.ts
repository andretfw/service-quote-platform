import { calculateQuote, validateAnswers } from "../lib/pricing-engine";
import { templates } from "../lib/templates";

const sampleValue = (question: (typeof templates)[number]["questions"][number]) => {
  if (question.type === "number") return Math.max(question.min ?? 1, 10);
  if (question.type === "choice") return question.options?.[0]?.value ?? "x";
  if (question.type === "multiselect") return question.options?.slice(0, 1).map((o) => o.value) ?? [];
  if (question.type === "postcode") return "10001";
  return "test";
};

for (const template of templates) {
  const answers = Object.fromEntries(template.questions.map((q) => [q.id, sampleValue(q)]));
  const errors = validateAnswers(template, answers);
  if (errors.length) throw new Error(`${template.slug}: ${errors.join(", ")}`);

  const result = calculateQuote(template, answers);
  if (result.low > result.subtotal || result.subtotal > result.high) {
    throw new Error(`${template.slug}: invalid quote range`);
  }
}

console.log(`Validated ${templates.length} templates.`);
