"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getUser } from "@/lib/auth";
import { useLang } from "./LangProvider";
import { t, type Language } from "@/lib/i18n";
import type { AuthUser } from "@/lib/auth";

type Role = "admin" | "manager" | "operator";

interface NavItem {
  href: string;
  label_key: string; // i18n key
  icon: string;
  roles: Role[];
}

function getNavItems(lang: Language): { operator: NavItem[]; manager: NavItem[]; admin: NavItem[] } {
  return {
    operator: [
      { href: "/clients",       label_key: "sidebar.clients",       icon: "bi-people",      roles: ["admin","manager","operator"] },
      { href: "/locations",     label_key: "sidebar.locations",     icon: "bi-geo-alt",     roles: ["admin","manager","operator"] },
      { href: "/subscriptions", label_key: "sidebar.subscriptions", icon: "bi-link-45deg",  roles: ["admin","manager","operator"] },
      { href: "/calculations",  label_key: "sidebar.calculations",  icon: "bi-calculator",  roles: ["admin","manager","operator"] },
    ],
    manager: [
      { href: "/statistics",    label_key: "sidebar.statistics",    icon: "bi-bar-chart-line", roles: ["admin","manager"] },
      { href: "/services",      label_key: "sidebar.services",      icon: "bi-grid",           roles: ["admin","manager"] },
      { href: "/periods",       label_key: "sidebar.periods",       icon: "bi-calendar3",      roles: ["admin","manager"] },
    ],
    admin: [
      { href: "/users",         label_key: "sidebar.users",         icon: "bi-person-gear", roles: ["admin"] },
    ],
  };
}

function NavGroup({ title_key, items, pathname, role, lang }: {
  title_key?: string;
  items: NavItem[];
  pathname: string;
  role: Role;
  lang: Language;
}) {
  const visible = items.filter((i) => i.roles.includes(role));
  if (visible.length === 0) return null;
  return (
    <>
      {title_key && (
        <div style={{
          fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em",
          color: "#475569", padding: "0.75rem 1.25rem 0.25rem", marginTop: "0.25rem",
          borderTop: "1px solid #1e293b",
        }}>
          {t(title_key, lang)}
        </div>
      )}
      {visible.map((item) => (
        <li key={item.href} className="nav-item">
          <Link
            href={item.href}
            className={`nav-link ${
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                ? "active" : ""
            }`}
          >
            <i className={`bi ${item.icon}`} />
            {t(item.label_key, lang)}
          </Link>
        </li>
      ))}
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { lang } = useLang();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, [pathname]);

  if (pathname === "/login" || pathname === "/login/") return null;

  if (!mounted) return <nav className="bc-sidebar" style={{ width: 240 }} />;

  const role: Role = (user?.role as Role) ?? "operator";
  const navItems = getNavItems(lang);

  return (
    <nav className="bc-sidebar d-flex flex-column">
      <div className="brand">Bill<span>Core</span></div>
      <ul className="nav flex-column mt-2 flex-grow-1">

        <NavGroup
          title_key="sidebar.operations"
          items={navItems.operator}
          pathname={pathname}
          role={role}
          lang={lang}
        />

        <NavGroup
          title_key="sidebar.management"
          items={navItems.manager}
          pathname={pathname}
          role={role}
          lang={lang}
        />

        <NavGroup
          title_key="sidebar.administration"
          items={navItems.admin}
          pathname={pathname}
          role={role}
          lang={lang}
        />

      </ul>
    </nav>
  );
}
