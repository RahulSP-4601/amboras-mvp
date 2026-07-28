import { AppShell } from "@/components/app/app-shell";
import { isSupabaseConfigured } from "@/lib/env";
import { getOwnedStoreName } from "@/lib/stores/owned-draft";
import "./app.css";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const storeName = isSupabaseConfigured() ? await getOwnedStoreName() : null;
  return <AppShell storeName={storeName}>{children}</AppShell>;
}
