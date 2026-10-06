"use client";
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
      {label}
      <input
        className="field"
        type="number"
        min={min}
        max={max}
        step="any"
        value={value}
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
              Question
              <select
                className="field"
                value={condition.field}
                onChange={(event) =>
                  update(index, { field: event.target.value, op: "truthy", value: undefined })
                }
              >
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Match
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
                <option value="truthy">Has an answer</option>
                {question?.type === "multiselect" ? (
                  <option value="includes">Includes</option>
                ) : (
                  <>
                    <option value="eq">Equals</option>
                    <option value="neq">Does not equal</option>
                  </>
                )}
                {question?.type === "number" && (
                  <>
                    <option value="gt">Greater than</option>
                    <option value="gte">At least</option>
                    <option value="lt">Less than</option>
                    <option value="lte">At most</option>
                  </>
                )}
              </select>
            </label>
            {condition.op !== "truthy" &&
              (question?.options ? (
                <label>
                  Value
                  <select
                    className="field"
                    value={String(condition.value ?? "")}
                    onChange={(e) => update(index, { value: e.target.value })}
                  >
                    {question.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  Value
                  <input
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
              Remove condition
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
          Add condition
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
}: {
  question: Question;
  questions: Question[];
  onChange: (question: Question) => void;
  onRemove: () => void;
  onOptionsChange: (question: Question) => void;
}) {
  return (
    <details className="editor-section">
      <summary>
        {question.label} · {question.type}
      </summary>
      <label className="editor-field">
        Question
        <input
          className="field"
          value={question.label}
          onChange={(e) => onChange({ ...question, label: e.target.value })}
        />
      </label>
      <label className="editor-field">
        Help text and measurement unit
        <input
          className="field"
          value={question.help ?? ""}
          placeholder="For example: area in square metres"
          onChange={(e) => onChange({ ...question, help: e.target.value })}
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={question.required ?? false}
          onChange={(e) => onChange({ ...question, required: e.target.checked })}
        />
        Required
      </label>
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
            Option {i + 1}
            <input
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
            Remove
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
          Add option
        </button>
      )}
      <h4>Only show when</h4>
      <ConditionsEditor
        conditions={question.showWhen ?? []}
        questions={questions.filter((q) => q.id !== question.id)}
        onChange={(showWhen) => onChange({ ...question, showWhen })}
      />
      <button className="btn secondary" type="button" onClick={onRemove}>
        Remove question
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
      Pricing question
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
            {q.label}
          </option>
        ))}
      </select>
    </label>
  );
  if (rule.kind === "number")
    return (
      <div>
        {fieldSelector}
        <NumberField
          label={`${question?.label ?? rule.field}: price per unit`}
          value={rule.perUnit}
          onChange={(perUnit) => onChange({ ...rule, perUnit })}
        />
        {(["minUnits", "maxUnits"] as const).map((key) => (
          <label className="editor-field" key={key}>
            {key === "minUnits"
              ? "Minimum billable units (optional)"
              : "Maximum billable units (optional)"}
            <input
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
      </div>
    );
  return (
    <div>
      {fieldSelector}
      <h4>
        {question?.label ?? rule.field} ·{" "}
        {rule.kind === "multiplier" ? "multiplier (1 = unchanged)" : "additional price"}
      </h4>
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
