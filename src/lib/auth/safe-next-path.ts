export function safeNextPath(
  value: string | null,
  applicationUrl: URL,
): string {
  if (!value || !value.startsWith("/")) return "/app";
  try {
    const destination = new URL(value, applicationUrl);
    if (destination.origin !== applicationUrl.origin) return "/app";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/app";
  }
}
