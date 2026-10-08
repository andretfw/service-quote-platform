import { uiLocale } from "@/lib/server/locale";
import { Text } from "@/components/Language";
import AppShell from "@/components/AppShell";
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
  const presentation = await leadPresentation(workspace.db, lead, await uiLocale());
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
    <AppShell>
      <main className="shell app-page">
        <h1>{lead.lead_name}</h1>
        <p className="muted">
          <Text>{presentation.name}</Text>
        </p>
        <section className="card">
          <h2>
            <Text>{"Enquiry details"}</Text>
          </h2>
          <p>
            <strong>
              <Text>{"Estimated range:"}</Text>
            </strong>{" "}
            {presentation.estimate}
          </p>
          <p className="muted">
            <Text>
              {"Preliminary estimate. Confirm the scope and final price with the customer."}
            </Text>
          </p>
          <div className="row">
            {lead.lead_email && <a href={`mailto:${lead.lead_email}`}>{lead.lead_email}</a>}
            {lead.lead_phone && <span>{lead.lead_phone}</span>}
            <LeadStatus id={lead.id} status={lead.status} />
          </div>
          <p className="muted">
            <Text>{"Received"}</Text>{" "}
            {new Date(lead.created_at).toLocaleString(presentation.locale, { timeZone: "UTC" })}{" "}
            <Text>{"UTC"}</Text>
          </p>
          <dl className="answer-details">
            {presentation.answers.map((item, index) => (
              <div key={index}>
                <dt>
                  <Text>{item.label}</Text>
                </dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          {!presentation.answers.length && (
            <p className="muted">
              <Text>{"No project answers were recorded."}</Text>
            </p>
          )}
        </section>
        <section className="card">
          <h2>
            <Text>{"Business email alert"}</Text>
          </h2>
          <p>
            <Text>{status}</Text>
          </p>
          {pending && configured && <NotificationRetry id={lead.id} />}
        </section>
      </main>
    </AppShell>
  );
}
