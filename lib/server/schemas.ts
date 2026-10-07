import "server-only";
import { z } from "zod";

const answerValue = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(200)).max(20),
  z.null(),
]);

export const answersSchema = z
  .record(z.string().min(1).max(100), answerValue)
  .refine((answers) => Object.keys(answers).length <= 100, "Too many answers");

export const magicLinkRequestSchema = z.object({
  email: z.string().trim().email().max(254),
});

export const calculateRequestSchema = z.object({
  template: z.string().min(1).max(100),
  answers: answersSchema,
});

export const submitRequestSchema = z.object({
  template: z.string().min(1).max(100),
  answers: answersSchema,
  contactConsent: z.literal(true, {
    error: "Please allow the business to contact you about this request",
  }),
  followUpConsent: z.boolean().default(false),
  lead: z
    .object({
      name: z.string().trim().min(1).max(120),
      email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
      phone: z.string().trim().max(40).optional(),
    })
    .refine((lead) => Boolean(lead.email || lead.phone), {
      message: "An email address or phone number is required",
    }),
});

export const customerActionSchema = z.object({
  submissionId: z.string().uuid(),
  accessToken: z.string().min(32).max(128),
});

export const bookingRequestSchema = customerActionSchema.extend({
  startsAt: z.string().datetime({ offset: true }),
});

export const checkoutRequestSchema = customerActionSchema;

const conditionSchema = z
  .object({
    field: z.string().min(1).max(100),
    op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "includes", "truthy"]),
    value: z.union([z.string().max(200), z.number().finite(), z.boolean()]).optional(),
  })
  .superRefine((condition, ctx) => {
    if (condition.op !== "truthy" && condition.value === undefined) {
      ctx.addIssue({ code: "custom", message: `${condition.op} conditions require a value` });
    }

    if (["gt", "gte", "lt", "lte"].includes(condition.op) && typeof condition.value !== "number") {
      ctx.addIssue({
        code: "custom",
        message: `${condition.op} conditions require a numeric value`,
      });
    }

    if (condition.op === "includes" && typeof condition.value !== "string") {
      ctx.addIssue({ code: "custom", message: "includes conditions require a string value" });
    }
  });

type TemplateCondition = z.infer<typeof conditionSchema>;

const optionSchema = z.object({
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(120),
});

const questionSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    label: z.string().min(1).max(240),
    help: z.string().max(500).optional(),
    type: z.enum(["choice", "multiselect", "number", "text", "postcode"]),
    required: z.boolean().optional(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    step: z.number().positive().finite().optional(),
    options: z.array(optionSchema).max(100).optional(),
    showWhen: z.array(conditionSchema).max(20).optional(),
  })
  .superRefine((question, ctx) => {
    if (question.min !== undefined && question.max !== undefined && question.min > question.max) {
      ctx.addIssue({ code: "custom", message: "Question minimum cannot exceed maximum" });
    }

    if (["choice", "multiselect"].includes(question.type) && !question.options?.length) {
      ctx.addIssue({ code: "custom", message: "Choice questions require at least one option" });
    }

    if (question.options) {
      const values = new Set<string>();
      for (const option of question.options) {
        if (values.has(option.value)) {
          ctx.addIssue({ code: "custom", message: `Duplicate option value: ${option.value}` });
        }
        values.add(option.value);
      }
    }
  });

const moneyMapSchema = z.record(z.string().max(120), z.number().finite());
const multiplierMapSchema = z.record(z.string().max(120), z.number().nonnegative().finite());

const pricingRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("base"), amount: z.number().nonnegative().finite() }),
  z
    .object({
      kind: z.literal("number"),
      field: z.string().min(1).max(100),
      perUnit: z.number().nonnegative().finite(),
      when: z.array(conditionSchema).max(20).optional(),
      minUnits: z.number().finite().optional(),
      maxUnits: z.number().finite().optional(),
    })
    .superRefine((rule, ctx) => {
      if (
        rule.minUnits !== undefined &&
        rule.maxUnits !== undefined &&
        rule.minUnits > rule.maxUnits
      ) {
        ctx.addIssue({ code: "custom", message: "Minimum units cannot exceed maximum units" });
      }
    }),
  z.object({
    kind: z.literal("choice"),
    field: z.string().min(1).max(100),
    map: moneyMapSchema,
  }),
  z.object({
    kind: z.literal("multiselect"),
    field: z.string().min(1).max(100),
    map: moneyMapSchema,
  }),
  z.object({
    kind: z.literal("conditional"),
    when: z.array(conditionSchema).min(1).max(20),
    amount: z.number().finite(),
  }),
  z.object({
    kind: z.literal("multiplier"),
    field: z.string().min(1).max(100),
    map: multiplierMapSchema,
  }),
]);

const quoteTemplateBaseSchema = z.object({
  settings: z
    .object({
      businessName: z.string().trim().max(160).optional(),
      logoDataUrl: z
        .string()
        .max(90000)
        .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/)
        .optional(),
      accentColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
      bookingRequests: z.boolean().optional(),
      deposits: z.boolean().optional(),
      followUps: z.boolean().optional(),
      depositPercent: z.number().min(1).max(100).optional(),
      taxRatePct: z.number().min(0).max(100).optional(),
    })
    .optional(),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/),
  name: z.string().min(1).max(160),
  industry: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  currency: z.enum(["EUR", "USD", "GBP", "RON", "CAD", "AUD"]),
  minPrice: z.number().nonnegative().finite().optional(),
  rangePct: z.number().min(0).max(0.5).finite().optional(),
  questions: z.array(questionSchema).min(1).max(100),
  rules: z.array(pricingRuleSchema).min(1).max(200),
});

export const quoteTemplateSchema = quoteTemplateBaseSchema.superRefine((template, ctx) => {
  const questions = new Map<string, (typeof template.questions)[number]>();

  template.questions.forEach((question, questionIndex) => {
    if (questions.has(question.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["questions", questionIndex, "id"],
        message: `Duplicate question id: ${question.id}`,
      });
    }
    questions.set(question.id, question);
  });

  const validateCondition = (condition: TemplateCondition, path: (string | number)[]) => {
    const question = questions.get(condition.field);
    if (!question) {
      ctx.addIssue({
        code: "custom",
        path: [...path, "field"],
        message: `Unknown condition field: ${condition.field}`,
      });
      return;
    }

    if (["gt", "gte", "lt", "lte"].includes(condition.op) && question.type !== "number") {
      ctx.addIssue({
        code: "custom",
        path: [...path, "op"],
        message: `${condition.op} can only target number questions`,
      });
    }

    if (condition.op === "includes") {
      if (question.type !== "multiselect") {
        ctx.addIssue({
          code: "custom",
          path: [...path, "op"],
          message: "includes can only target multiselect questions",
        });
      } else if (
        typeof condition.value === "string" &&
        !question.options?.some((option) => option.value === condition.value)
      ) {
        ctx.addIssue({
          code: "custom",
          path: [...path, "value"],
          message: `Unknown option value for ${condition.field}: ${condition.value}`,
        });
      }
    }

    if (["eq", "neq"].includes(condition.op)) {
      if (question.type === "multiselect") {
        ctx.addIssue({
          code: "custom",
          path: [...path, "op"],
          message: `${condition.op} cannot target multiselect questions; use includes`,
        });
      } else if (question.type === "number" && typeof condition.value !== "number") {
        ctx.addIssue({
          code: "custom",
          path: [...path, "value"],
          message: `${condition.field} requires a numeric condition value`,
        });
      } else if (
        question.type === "choice" &&
        (typeof condition.value !== "string" ||
          !question.options?.some((option) => option.value === condition.value))
      ) {
        ctx.addIssue({
          code: "custom",
          path: [...path, "value"],
          message: `Unknown option value for ${condition.field}: ${String(condition.value)}`,
        });
      } else if (
        (question.type === "text" || question.type === "postcode") &&
        typeof condition.value !== "string"
      ) {
        ctx.addIssue({
          code: "custom",
          path: [...path, "value"],
          message: `${condition.field} requires a text condition value`,
        });
      }
    }
  };

  template.questions.forEach((question, questionIndex) => {
    question.showWhen?.forEach((condition, conditionIndex) => {
      validateCondition(condition, ["questions", questionIndex, "showWhen", conditionIndex]);
    });
  });

  const visibilityDependencies = new Map(
    template.questions.map((question) => [
      question.id,
      question.showWhen?.map((condition) => condition.field) ?? [],
    ]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visitQuestion = (questionId: string): boolean => {
    if (visiting.has(questionId)) return true;
    if (visited.has(questionId)) return false;

    visiting.add(questionId);
    for (const dependency of visibilityDependencies.get(questionId) ?? []) {
      if (questions.has(dependency) && visitQuestion(dependency)) return true;
    }
    visiting.delete(questionId);
    visited.add(questionId);
    return false;
  };

  for (const question of template.questions) {
    if (visitQuestion(question.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["questions"],
        message: "Question visibility conditions must not contain dependency cycles",
      });
      break;
    }
  }

  const validateMappedRule = (
    field: string,
    map: Record<string, number>,
    expectedType: "choice" | "multiselect",
    ruleIndex: number,
  ) => {
    const question = questions.get(field);
    if (!question) {
      ctx.addIssue({
        code: "custom",
        path: ["rules", ruleIndex, "field"],
        message: `Unknown pricing field: ${field}`,
      });
      return;
    }
    if (question.type !== expectedType) {
      ctx.addIssue({
        code: "custom",
        path: ["rules", ruleIndex, "field"],
        message: `${field} must reference a ${expectedType} question`,
      });
      return;
    }

    const allowed = new Set(question.options?.map((option) => option.value) ?? []);
    Object.keys(map).forEach((key) => {
      if (!allowed.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["rules", ruleIndex, "map", key],
          message: `Unknown option value for ${field}: ${key}`,
        });
      }
    });
  };

  template.rules.forEach((rule, ruleIndex) => {
    if (rule.kind === "number") {
      rule.when?.forEach((condition, conditionIndex) => {
        validateCondition(condition, ["rules", ruleIndex, "when", conditionIndex]);
      });
      const question = questions.get(rule.field);
      if (!question) {
        ctx.addIssue({
          code: "custom",
          path: ["rules", ruleIndex, "field"],
          message: `Unknown pricing field: ${rule.field}`,
        });
      } else if (question.type !== "number") {
        ctx.addIssue({
          code: "custom",
          path: ["rules", ruleIndex, "field"],
          message: `${rule.field} must reference a number question`,
        });
      }
    } else if (rule.kind === "choice") {
      validateMappedRule(rule.field, rule.map, "choice", ruleIndex);
    } else if (rule.kind === "multiselect") {
      validateMappedRule(rule.field, rule.map, "multiselect", ruleIndex);
    } else if (rule.kind === "multiplier") {
      validateMappedRule(rule.field, rule.map, "choice", ruleIndex);
    } else if (rule.kind === "conditional") {
      rule.when.forEach((condition, conditionIndex) => {
        validateCondition(condition, ["rules", ruleIndex, "when", conditionIndex]);
      });
    }
  });
});

export const createCalculatorRequestSchema = z.object({
  template: quoteTemplateSchema,
});

export const reviseCalculatorRequestSchema = z.object({
  template: quoteTemplateSchema,
  expectedVersion: z.number().int().positive(),
});
