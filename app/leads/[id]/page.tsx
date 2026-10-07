import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import LeadStatus from "@/components/LeadStatus";
import NotificationRetry from "@/components/NotificationRetry";
import { pageWorkspace } from "@/lib/server/page-workspace";
import { leadPresentation, workspaceLead } from "@/lib/server/lead-details";
import { emailAlertsConfigured } from "@/lib/server/notifications";

export const dynamic = "force-dynamic";

export default async function LeadDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const workspace = await pageWorkspace();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const lead = await workspaceLead(workspace, id);
  if (!lead) notFound();
  const presentation = await leadPresentation(workspace.db, lead);
  const { data: notifications, error } = await workspace.db
    .from("notification_outbox")
    .select("sent_at")
    .eq("submission_id", lead.id);
  if (error) throw new Error("Unable to load enquiry email status");
  const pending = notifications.some((item) => !item.sent_at);
  const configured = emailAlertsConfigured();
  const status = !notifications.length
    ? "No business email recipient was available when this enquiry arrived."
    : !configured && pending
      ? "Email alerts are not configured. This enquiry is safely saved in your dashboard."
      : pending
        ? "Email alert is queued for sending. Automatic retries run every 15 minutes when scheduling is configured."
        : "Email alert accepted by the email provider. Inbox delivery is not guaranteed; check spam if it is missing.";
  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/leads">
          ← Leads
        </Link>
      </nav>
      <h1>{lead.lead_name}</h1>
      <p className="muted">{presentation.name}</p>
      <section className="card">
        <h2>Enquiry details</h2>
        <p>
          <strong>Estimated range:</strong> {presentation.estimate}
        </p>
        <p className="muted">
          Preliminary estimate. Confirm the scope and final price with the customer.
        </p>
        <div className="row">
          {lead.lead_email && <a href={`mailto:${lead.lead_email}`}>{lead.lead_email}</a>}
          {lead.lead_phone && <span>{lead.lead_phone}</span>}
          <LeadStatus id={lead.id} status={lead.status} />
        </div>
        <p className="muted">
          Received {new Date(lead.created_at).toLocaleString("en", { timeZone: "UTC" })} UTC
        </p>
        <dl className="answer-details">
          {presentation.answers.map((item, index) => (
            <div key={index}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        {!presentation.answers.length && <p className="muted">No project answers were recorded.</p>}
      </section>
      <section className="card">
        <h2>Business email alert</h2>
        <p>{status}</p>
        {pending && configured && <NotificationRetry id={lead.id} />}
      </section>
    </main>
  );
}
