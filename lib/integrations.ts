export function integrationDestination(value: string): {
  url: string;
  provider: "zapier" | "make";
} {
  const url = new URL(value.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  )
    throw new Error("Use a Zapier Catch Hook or Make custom webhook URL");
  if (
    url.hostname === "hooks.zapier.com" &&
    /^\/hooks\/catch\/\d+\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
  )
    return { url: url.href, provider: "zapier" };
  if (
    /^hook\.(eu1|eu2|us1|us2)\.make\.com$/.test(url.hostname) &&
    /^\/[A-Za-z0-9]{20,128}$/.test(url.pathname)
  )
    return { url: url.href, provider: "make" };
  throw new Error("Use a Zapier Catch Hook or Make custom webhook URL");
}
