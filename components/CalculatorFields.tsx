"use client";
import { Text, LocalizedInput } from "@/components/Language";

import { useLanguage } from "./Language";
import { inferredUnit, units, type Unit } from "@/lib/units";
import type { Condition, PricingRule, Question } from "@/lib/types";

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="editor-field">
      <Text>{label}</Text>
      <LocalizedInput
        className="field"
        type="number"
        min={min}
        max={max}
        step="any"
        value={Number(value.toPrecision(8))}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function ConditionsEditor({
  conditions,
  questions,
  onChange,
}: {
  conditions: Condition[];
  questions: Question[];
  onChange: (conditions: Condition[]) => void;
}) {
  function update(index: number, patch: Partial<Condition>) {
    onChange(
      conditions.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)),
    );
  }
  return (
    <div>
      {conditions.map((condition, index) => {
        const question = questions.find((q) => q.id === condition.field);
        return (
          <div className="editor-condition" key={index}>
            <label>
              <Text>{"Question"}</Text>
              <select
                className="field"
                value={condition.field}
                onChange={(event) =>
                  update(index, { field: event.target.value, op: "truthy", value: undefined })
                }
              >
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    <Text>{q.label}</Text>
                  </option>
                ))}
              </select>
            </label>
            <label>
              <Text>{"Match"}</Text>
              <select
                className="field"
                value={condition.op}
                onChange={(event) => {
                  const op = event.target.value as Condition["op"];
                  update(index, {
                    op,
                    value:
                      op === "truthy"
                        ? undefined
                        : question?.type === "number"
                          ? 0
                          : (question?.options?.[0]?.value ?? ""),
                  });
                }}
              >
                <option value="truthy">
                  <Text>{"Has an answer"}</Text>
                </option>
                {question?.type === "multiselect" ? (
                  <option value="includes">
                    <Text>{"Includes"}</Text>
                  </option>
                ) : (
                  <>
                    <option value="eq">
                      <Text>{"Equals"}</Text>
                    </option>
                    <option value="neq">
                      <Text>{"Does not equal"}</Text>
                    </option>
                  </>
                )}
                {question?.type === "number" && (
                  <>
                    <option value="gt">
                      <Text>{"Greater than"}</Text>
                    </option>
                    <option value="gte">
                      <Text>{"At least"}</Text>
                    </option>
                    <option value="lt">
                      <Text>{"Less than"}</Text>
                    </option>
                    <option value="lte">
                      <Text>{"At most"}</Text>
                    </option>
                  </>
                )}
              </select>
            </label>
            {condition.op !== "truthy" &&
              (question?.options ? (
                <label>
                  <Text>{"Value"}</Text>
                  <select
                    className="field"
                    value={String(condition.value ?? "")}
                    onChange={(e) => update(index, { value: e.target.value })}
                  >
                    {question.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        <Text>{o.label}</Text>
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  <Text>{"Value"}</Text>
                  <LocalizedInput
                    className="field"
                    type={question?.type === "number" ? "number" : "text"}
                    value={String(condition.value ?? "")}
                    onChange={(e) =>
                      update(index, {
                        value:
                          question?.type === "number" ? Number(e.target.value) : e.target.value,
                      })
                    }
                  />
                </label>
              ))}
            <button
              className="btn secondary"
              type="button"
              onClick={() => onChange(conditions.filter((_, i) => i !== index))}
            >
              <Text>{"Remove condition"}</Text>
            </button>
          </div>
        );
      })}
      {questions.length > 0 && (
        <button
          className="btn secondary"
          type="button"
          onClick={() => onChange([...conditions, { field: questions[0].id, op: "truthy" }])}
        >
          <Text>{"Add condition"}</Text>
        </button>
      )}
    </div>
  );
}

export function QuestionEditor({
  question,
  questions,
  onChange,
  onRemove,
  onOptionsChange,
  onUnitChange,
}: {
  question: Question;
  questions: Question[];
  onChange: (question: Question) => void;
  onRemove: () => void;
  onOptionsChange: (question: Question) => void;
  onUnitChange?: (unit: Unit) => void;
}) {
  return (
    <details className="editor-section">
      <summary>
        <Text>{question.label}</Text> ·{" "}
        <Text>
          {
            {
              number: "Quantity",
              choice: "Single choice",
              multiselect: "Multiple choice",
              text: "Short text",
              postcode: "Postal code",
            }[question.type]
          }
        </Text>
      </summary>
      <label className="editor-field">
        <Text>{"Question"}</Text>
        <LocalizedInput
          className="field"
          value={question.label}
          onChange={(e) => onChange({ ...question, label: e.target.value })}
        />
      </label>
      <label className="editor-field">
        <Text>{"Help text"}</Text>
        <LocalizedInput
          className="field"
          value={question.help ?? ""}
          placeholder="For example: area in square metres"
          onChange={(e) => onChange({ ...question, help: e.target.value })}
        />
      </label>
      <label className="check-label">
        <LocalizedInput
          type="checkbox"
          checked={question.required ?? false}
          onChange={(e) => onChange({ ...question, required: e.target.checked })}
        />
        <Text>{"Required"}</Text>
      </label>
      {question.type === "number" && onUnitChange && (
        <label className="editor-field">
          <Text>Measurement unit</Text>
          <select
            className="field"
            value={inferredUnit(question) ?? ""}
            onChange={(e) => onUnitChange(e.target.value as Unit)}
          >
            <option value="" disabled>
              <Text>No measurement unit</Text>
            </option>
            {Object.entries(units)
              .filter(
                ([, value]) =>
                  !inferredUnit(question) ||
                  value.dimension === units[inferredUnit(question)!].dimension,
              )
              .map(([key, value]) => (
                <option key={key} value={key}>
                  {value.symbol}
                </option>
              ))}
          </select>
        </label>
      )}
      {question.type === "number" && (
        <div className="grid">
          <NumberField
            label="Minimum"
            value={question.min ?? 0}
            onChange={(min) => onChange({ ...question, min })}
          />
          <NumberField
            label="Maximum"
            value={question.max ?? 100000}
            onChange={(max) => onChange({ ...question, max })}
          />
          <NumberField
            label="Step"
            value={question.step ?? 1}
            min={0.001}
            onChange={(step) => onChange({ ...question, step })}
          />
        </div>
      )}
      {question.options?.map((option, i) => (
        <div className="row" key={option.value}>
          <label className="editor-field">
            <Text>{"Option"}</Text>
            {i + 1}
            <LocalizedInput
              className="field"
              value={option.label}
              onChange={(e) =>
                onChange({
                  ...question,
                  options: question.options?.map((o, index) =>
                    index === i ? { ...o, label: e.target.value } : o,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className="btn secondary"
            disabled={question.options?.length === 1}
            onClick={() =>
              onOptionsChange({
                ...question,
                options: question.options?.filter((o) => o.value !== option.value),
              })
            }
          >
            <Text>{"Remove"}</Text>
          </button>
        </div>
      ))}
      {question.options && (
        <button
          type="button"
          className="btn secondary"
          onClick={() =>
            onOptionsChange({
              ...question,
              options: [
                ...question.options!,
                { label: "New option", value: `option_${crypto.randomUUID().slice(0, 8)}` },
              ],
            })
          }
        >
          <Text>{"Add option"}</Text>
        </button>
      )}
      <details className="advanced-panel">
        <summary>
          <Text>Advanced settings</Text>
        </summary>
        <h4>
          <Text>{"Only show when"}</Text>
        </h4>
        <ConditionsEditor
          conditions={question.showWhen ?? []}
          questions={questions.filter((q) => q.id !== question.id)}
          onChange={(showWhen) => onChange({ ...question, showWhen })}
        />
      </details>
      <button className="text-button danger" type="button" onClick={onRemove}>
        <Text>{"Remove question"}</Text>
      </button>
    </details>
  );
}

export function PricingEditor({
  rule,
  questions,
  onChange,
}: {
  rule: PricingRule;
  questions: Question[];
  onChange: (rule: PricingRule) => void;
}) {
  const { t } = useLanguage();
  if (rule.kind === "base")
    return (
      <NumberField
        label="Base price"
        value={rule.amount}
        onChange={(amount) => onChange({ ...rule, amount })}
      />
    );
  if (rule.kind === "conditional")
    return (
      <div>
        <NumberField
          label="Conditional adjustment"
          value={rule.amount}
          min={-100000}
          onChange={(amount) => onChange({ ...rule, amount })}
        />
        <ConditionsEditor
          conditions={rule.when}
          questions={questions}
          onChange={(when) => onChange({ ...rule, when })}
        />
      </div>
    );
  const question = questions.find((q) => q.id === rule.field);
  const compatible = questions.filter(
    (q) => q.type === (rule.kind === "multiplier" ? "choice" : rule.kind),
  );
  const fieldSelector = (
    <label className="editor-field">
      <Text>{"Pricing question"}</Text>
      <select
        className="field"
        value={rule.field}
        onChange={(event) => {
          const next = compatible.find((q) => q.id === event.target.value);
          if (!next) return;
          if (rule.kind === "number") onChange({ ...rule, field: next.id });
          else
            onChange({
              ...rule,
              field: next.id,
              map: Object.fromEntries(
                next.options!.map((option) => [option.value, rule.kind === "multiplier" ? 1 : 0]),
              ),
            });
        }}
      >
        {compatible.map((q) => (
          <option key={q.id} value={q.id}>
            <Text>{q.label}</Text>
          </option>
        ))}
      </select>
    </label>
  );
  if (rule.kind === "number")
    return (
      <div>
        <h3>{question?.label ?? rule.field}</h3>
        <NumberField
          label={`${t("Price per unit")} ${question && inferredUnit(question) ? `(${units[inferredUnit(question)!].symbol})` : ""}`}
          value={rule.perUnit}
          onChange={(perUnit) => onChange({ ...rule, perUnit })}
        />
        <details className="advanced-panel">
          <summary>
            <Text>Advanced settings</Text>
          </summary>
          {fieldSelector}
          <h4>
            <Text>{"Only apply this rate when"}</Text>
          </h4>
          <ConditionsEditor
            conditions={rule.when ?? []}
            questions={questions}
            onChange={(when) => onChange({ ...rule, when })}
          />
          {(["minUnits", "maxUnits"] as const).map((key) => (
            <label className="editor-field" key={key}>
              <Text>
                {key === "minUnits"
                  ? "Minimum billable units (optional)"
                  : "Maximum billable units (optional)"}
              </Text>
              <LocalizedInput
                className="field"
                type="number"
                step="any"
                value={rule[key] ?? ""}
                onChange={(event) =>
                  onChange({
                    ...rule,
                    [key]: event.target.value === "" ? undefined : Number(event.target.value),
                  })
                }
              />
            </label>
          ))}
        </details>
      </div>
    );
  return (
    <div>
      <h4>
        {question?.label ?? rule.field} ·<Text> </Text>
        <Text>{t(rule.kind === "multiplier" ? "Price multiplier" : "Additional price")}</Text>
      </h4>
      {rule.kind === "multiplier" && (
        <p className="muted small">
          <Text>1 = unchanged; 1.2 = 20% more.</Text>
        </p>
      )}
      <details className="advanced-panel">
        <summary>
          <Text>Pricing question</Text>
        </summary>
        {fieldSelector}
      </details>
      {Object.entries(rule.map).map(([key, amount]) => (
        <NumberField
          key={key}
          label={question?.options?.find((o) => o.value === key)?.label ?? key}
          value={amount}
          min={rule.kind === "multiplier" ? 0 : -100000}
          onChange={(value) => onChange({ ...rule, map: { ...rule.map, [key]: value } })}
        />
      ))}
    </div>
  );
}
