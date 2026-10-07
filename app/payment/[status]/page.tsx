import { Text } from "@/components/Language";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PaymentReturn({ params }: { params: Promise<{ status: string }> }) {
  const { status } = await params;
  if (!["success", "cancelled"].includes(status)) notFound();
  return (
    <main className="shell">
      <div className="card">
        <h1>
          <Text>{status === "success" ? "Checkout complete" : "Checkout cancelled"}</Text>
        </h1>
        <p>
          <Text>
            {status === "success"
              ? "Your business will confirm your deposit and booking details. Paying a deposit does not confirm a booking."
              : "You can return to your quote and reopen the deposit checkout when you are ready."}
          </Text>
        </p>
        <Link href="/">
          <Text>{"Return to Service Quote"}</Text>
        </Link>
      </div>
    </main>
  );
}
