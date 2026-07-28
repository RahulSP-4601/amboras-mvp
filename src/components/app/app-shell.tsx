import {
  Activity,
  BarChart3,
  Boxes,
  FlaskConical,
  Home,
  Package,
  Sparkles,
  Store,
} from "lucide-react";
import Link from "next/link";

import { SignOutForm } from "@/components/auth/signout-form";

const navigation = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/store", label: "Store", icon: Store },
  { href: "/app/product", label: "Product", icon: Package },
  { href: "/app/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/activity", label: "AI Activity", icon: Activity },
];

export function AppShell({
  children,
  storeName,
}: {
  children: React.ReactNode;
  storeName?: string | null;
}) {
  const displayName = storeName || "No store yet";
  const initial = storeName?.trim().slice(0, 1).toUpperCase() || "—";
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="brand" href="/app">
          <span className="brand-mark">
            <Sparkles size={17} />
          </span>
          Evolv
        </Link>
        <StoreIdentity displayName={displayName} initial={initial} />
        <nav aria-label="Application navigation">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
        <SignOutForm />
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <span>Workspace</span>
          <Link className="button button-secondary" href="/app/store">
            Preview store
          </Link>
        </header>
        <main className="app-content">{children}</main>
        <AiComposer />
      </div>
    </div>
  );
}

function StoreIdentity(props: { displayName: string; initial: string }) {
  return (
    <div className="store-switcher">
      <span className="store-avatar">{props.initial}</span>
      <span>
        <small>Current store</small>
        <strong>{props.displayName}</strong>
      </span>
      <Boxes size={16} />
    </div>
  );
}

function AiComposer() {
  return (
    <div className="ai-composer">
      <div className="composer-suggestions">
        <span>Improve the main message</span>
        <span>Strengthen product value</span>
      </div>
      <div className="composer-input">
        <Sparkles size={18} />
        <span>Ask Evolv to improve your store…</span>
        <button type="button" aria-label="Send prompt">
          ↗
        </button>
      </div>
    </div>
  );
}
