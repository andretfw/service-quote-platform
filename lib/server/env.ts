import "server-only";

const requireValue = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const publicSupabaseKey = (): string | undefined =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const databaseConfigured = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export const publicSupabaseConfigured = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && publicSupabaseKey());

export const getSupabasePublicEnv = () => {
  const publicKey = publicSupabaseKey();
  if (!publicKey) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return {
    url: requireValue("NEXT_PUBLIC_SUPABASE_URL"),
    publicKey,
  };
};

export const getSupabaseAdminEnv = () => ({
  url: requireValue("NEXT_PUBLIC_SUPABASE_URL"),
  serviceRoleKey: requireValue("SUPABASE_SERVICE_ROLE_KEY"),
});

export const stripeConfigured = (): boolean => Boolean(process.env.STRIPE_SECRET_KEY?.trim());

export const getStripeEnv = () => ({
  secretKey: requireValue("STRIPE_SECRET_KEY"),
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null,
});

export const getAppUrl = (fallbackOrigin: string): string => {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.URL?.trim();
  if (!configured && process.env.NODE_ENV === "production")
    throw new Error("NEXT_PUBLIC_APP_URL is required in production");
  const url = new URL(configured || fallbackOrigin);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Invalid application URL");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    throw new Error("Production application URL must use HTTPS");
  return url.origin;
};
