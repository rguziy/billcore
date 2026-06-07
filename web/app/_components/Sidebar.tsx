"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

type Role = "admin" | "manager" | "operator";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Role[]; // which roles can see this item
}

const operatorNav: NavItem[] = [
  { href: "/clients",       label: "Clients",       icon: "bi-people",      roles: ["admin","manager","operator"] },
  { href: "/locations",     label: "Locations",     icon: "bi-geo-alt",     roles: ["admin","manager","operator"] },
  { href: "/subscriptions", label: "Subscriptions", icon: "bi-link-45deg",  roles: ["admin","manager","operator"] },
  { href: "/calculations",  label: "Calculations",  icon: "bi-calculator",  roles: ["admin","manager","operator"] },
];

const managerNav: NavItem[] = [
  { href: "/statistics",    label: "Statistics",    icon: "bi-bar-chart-line", roles: ["admin","manager"] },
  { href: "/services",      label: "Services",      icon: "bi-grid",           roles: ["admin","manager"] },
  { href: "/periods",       label: "Periods",       icon: "bi-calendar3",      roles: ["admin","manager"] },
];

const adminNav: NavItem[] = [
  { href: "/users",         label: "Users",         icon: "bi-person-gear", roles: ["admin"] },
];

function NavGroup({ title, items, pathname, role }: {
  title?: string;
  items: NavItem[];
  pathname: string;
  role: Role;
}) {
  const visible = items.filter((i) => i.roles.includes(role));
  if (visible.length === 0) return null;
  return (
    <>
      {title && (
        <div style={{
          fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em",
          color: "#475569", padding: "1rem 1.25rem 0.25rem", marginTop: "0.5rem",
        }}>
          {title}
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
            {item.label}
          </Link>
        </li>
      ))}
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => { setUser(getUser()); }, [pathname]);

  if (pathname === "/login") return null;

  const role: Role = (user?.role as Role) ?? "operator";

  return (
    <nav className="bc-sidebar d-flex flex-column">
      <div className="brand">Bill<span>Core</span></div>
      <ul className="nav flex-column mt-2 flex-grow-1">

        <NavGroup items={operatorNav} pathname={pathname} role={role} />

        <NavGroup
          title="Management"
          items={managerNav}
          pathname={pathname}
          role={role}
        />

        <NavGroup
          title="Administration"
          items={adminNav}
          pathname={pathname}
          role={role}
        />

      </ul>
      <div className="px-3 pb-3" style={{ fontSize: "0.75rem", color: "#475569" }}>
        v0.2.0
      </div>
    </nav>
  );
}
