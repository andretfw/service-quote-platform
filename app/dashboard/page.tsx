import Link from "next/link";
import { pageWorkspace } from "@/lib/server/page-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

const quoteSummary = (quote: unknown) => {
  if (!quote || typeof quote !== "object") return null;
  const value = quote as Record<string, unknown>;
  const subtotal = Number(value.subtotal);
  const low = Number(value.low);
  const high = Number(value.high);
  const currency = typeof value.currency === "string" ? value.currency.toUpperCase() : "";

  if (!currency || !Number.isFinite(subtotal) || !Number.isFinite(low) || !Number.isFinite(high)) {
    return null;
  }

  return { subtotal, low, high, currency };
};

const quotedValueDisplay = (totals: Map<string, number>) => {
  const entries = [...totals.entries()].sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length) return { value: "—", detail: "No quotes yet" };
  if (entries.length === 1) {
    const [currency, value] = entries[0];
    return { value: money(value, currency), detail: currency };
  }

  return {
    value: `${entries.length} currencies`,
    detail: entries
      .map(([currency, value]) => `${currency} ${Math.round(value).toLocaleString("en")}`)
      .join(" · "),
  };
};

export default async function DashboardPage() {
  const workspace = await pageWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: calculators, error: calculatorError } = await workspace.db
    .from("calculators")
    .select("id")
    .eq("organization_id", workspace.organizationId);
  if (calculatorError) throw new Error("Unable to load business calculators");
  const { data, error } = await supabase
    .from("submissions")
    .select("id,lead_name,template_slug,quote,status,created_at")
    .in(
      "calculator_id",
      calculators.map((calculator) => calculator.id),
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("Unable to load dashboard data");
  const submissions = data ?? [];

  const total = submissions.length;
  const booked = submissions.filter((submission) =>
    ["booked", "won"].includes(submission.status),
  ).length;
  const totalsByCurrency = new Map<string, number>();

  for (const submission of submissions) {
    const quote = quoteSummary(submission.quote);
    if (!quote) continue;
    totalsByCurrency.set(
      quote.currency,
      (totalsByCurrency.get(quote.currency) ?? 0) + quote.subtotal,
    );
  }

  const conversion = total ? (booked / total) * 100 : 0;
  const quoted = quotedValueDisplay(totalsByCurrency);
  const stats = [
    { label: "Leads", value: String(total), detail: "Latest 100 submissions" },
    { label: "Quoted value", value: quoted.value, detail: quoted.detail },
    { label: "Booked / won", value: String(booked), detail: "Current pipeline" },
    { label: "Conversion", value: `${conversion.toFixed(1)}%`, detail: "Booked or won / leads" },
  ];

  return (
    <main className="shell">
      <div className="nav">
        <Link className="brand" href="/">
          Service Quote
        </Link>
        <Link href="/billing">Subscription</Link>
        <Link href="/workspace">My calculators</Link>
        <Link className="btn" href="/calculators">
          New calculator
        </Link>
      </div>

      <h1>Dashboard</h1>
      {!submissions.length && (
        <div className="card">
          <h2>Start receiving quote requests</h2>
          <p>
            Choose an industry template, enter your prices and save your calculator. Share its link
            with customers or add it to your website. Customer requests appear here and in your
            leads list.
          </p>
          <Link className="btn" href="/calculators">
            Create your first calculator
          </Link>
        </div>
      )}
      <div className="grid">
        {stats.map((stat) => (
          <div className="card" key={stat.label}>
            <span className="muted">{stat.label}</span>
            <div className="price" style={{ fontSize: 34 }}>
              {stat.value}
            </div>
            <div className="muted">{stat.detail}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="row">
          <h2>Recent leads</h2>
          <Link href="/leads">View all</Link>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Template</th>
              <th>Estimate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {submissions.slice(0, 8).map((submission) => {
              const quote = quoteSummary(submission.quote);

              return (
                <tr key={submission.id}>
                  <td>
                    <Link href={`/leads/${submission.id}`}>{submission.lead_name}</Link>
                  </td>
                  <td>{submission.template_slug || "Custom"}</td>
                  <td>
                    {quote
                      ? `${money(quote.low, quote.currency)}–${money(quote.high, quote.currency)}`
                      : "—"}
                  </td>
                  <td>
                    <span className="pill">{submission.status}</span>
                  </td>
                </tr>
              );
            })}
            {!submissions.length && (
              <tr>
                <td colSpan={4} className="muted">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
