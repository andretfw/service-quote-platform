import { Text } from "./Language";
export const faqs = [
  [
    "Do I need a website?",
    "No. Share your hosted calculator link in messages, emails or your social profile. If you have a website, add the embed code from the editor.",
  ],
  [
    "Do my customers need an account?",
    "No. Customers answer your questions, see an estimate and send an enquiry without signing in.",
  ],
  [
    "Is the Free plan a trial?",
    "No. Free includes one active calculator and seven enquiries per calendar month, with no card required. All 15 templates are included.",
  ],
  [
    "What counts as an enquiry?",
    "An enquiry is a successfully saved customer request. Previewing a demo or viewing an estimate does not use your enquiry allowance. The allowance is shared across your workspace calculators.",
  ],
  [
    "Can I change the questions and prices?",
    "Yes. Edit questions, answer options, rates, extra charges and your estimate tax percentage. Template prices are examples, so replace them with your own before sharing.",
  ],
  [
    "Does it support European measurements and languages?",
    "Yes. Use metric or imperial measurements, including metres, centimetres and square metres. English, Spanish and Romanian are available. Choose your currency separately; changing currency does not convert prices.",
  ],
  [
    "Which websites can I embed it in?",
    "Use a website block that accepts a script or iframe, including compatible WordPress, Wix, Squarespace, Webflow and Shopify pages. Your website plan must allow custom embeds. A hosted link works without an embed.",
  ],
  [
    "Can I connect my spreadsheet or CRM?",
    "Premium and Business can send new enquiries through a Zapier or Make webhook. Set up your destination app inside that tool. This is an automation connection, not a native CRM sync. The automation provider may charge separately.",
  ],
  [
    "Are bookings confirmed automatically?",
    "No. Business customers request a time and you confirm it. Business includes an internal booking calendar, working hours and blocked periods. Optional Google Calendar and Outlook connections add confirmed bookings and check external busy times. Provider setup is required.",
  ],
  [
    "Who receives customer deposits?",
    "Your business receives deposits through its own connected Stripe account on Business. Deposits are optional and need Stripe setup. Stripe fees are separate from your subscription.",
  ],
  [
    "What happens when I reach a limit or downgrade?",
    "New enquiries stop at your monthly allowance. Upgrade to accept more. Enquiries reset on the first day of each month in UTC. After a downgrade, saved data stays and the oldest active calculators remain available within your plan limit.",
  ],
  [
    "Who gets emails?",
    "The business owner gets new-enquiry alerts. Premium and Business can also enable reminders to customers who opt in. The platform sends these emails; connecting your own sender is not a workspace feature.",
  ],
] as const;
export default function Faq({ limit }: { limit?: number }) {
  return (
    <div className="faq-list">
      {faqs.slice(0, limit).map(([question, answer]) => (
        <details key={question}>
          <summary>
            <Text>{question}</Text>
          </summary>
          <p>
            <Text>{answer}</Text>
          </p>
        </details>
      ))}
    </div>
  );
}
