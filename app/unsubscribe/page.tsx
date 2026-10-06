import Unsubscribe from "@/components/Unsubscribe";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="shell">
      <Unsubscribe token={token ?? ""} />
    </main>
  );
}
