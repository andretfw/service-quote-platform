import LoginForm from "@/components/LoginForm";
import { databaseConfigured, publicSupabaseConfigured } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError =
    !databaseConfigured() || !publicSupabaseConfigured() || error === "not-configured"
      ? "Business accounts are temporarily unavailable. Please try again later."
      : error === "auth" || error === "missing-code"
        ? "This sign-in link is invalid or expired. Request a new link below."
        : null;
  return <LoginForm initialError={initialError} />;
}
