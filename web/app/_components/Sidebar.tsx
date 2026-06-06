"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { useEffect, useState } from "react";

const nav = [
  { href: "/",              label: "Dashboard",     icon: "bi-speedometer2", adminOnly: false },
  { href: "/clients",       label: "Clients",       icon: "bi-people",       adminOnly: false },
  { href: "/locations",     label: "Locations",     icon: "bi-geo-alt",      adminOnly: false },
  { href: "/services",      label: "Services",      icon: "bi-grid",         adminOnly: false },
  { href: "/subscriptions", label: "Subscriptions", icon: "bi-link-45deg",   adminOnly: false },
  { href: "/periods",       label: "Periods",       icon: "bi-calendar3",    adminOnly: false },
  { href: "/calculations",  label: "Calculations",  icon: "bi-calculator",   adminOnly: false },
  { href: "/users",         label: "Users",         icon: "bi-person-gear",  adminOnly: true  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [admin, setAdmin] = useState(false);

  useEffect(() => { setAdmin(isAdmin()); }, []);

  if (pathname === "/login") return null;

  return (
    <nav className="bc-sidebar d-flex flex-column">
      <div className="brand">Bill<span>Core</span></div>
      <ul className="nav flex-column mt-2 flex-grow-1">
        {nav
          .filter((item) => !item.adminOnly || admin)
          .map((item) => (
            <li key={item.href} className="nav-item">
              <Link
                href={item.href}
                className={`nav-link ${pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)) ? "active" : ""}`}
              >
                <i className={`bi ${item.icon}`} />
                {item.label}
              </Link>
            </li>
          ))}
      </ul>
      <div className="px-3 pb-3" style={{ fontSize: "0.75rem", color: "#475569" }}>
        v0.2.0
      </div>
    </nav>
  );
}
