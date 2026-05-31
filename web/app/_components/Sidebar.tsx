"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Dashboard", icon: "bi-speedometer2" },
  { href: "/clients", label: "Clients", icon: "bi-people" },
  { href: "/services", label: "Services", icon: "bi-grid" },
  { href: "/calculations", label: "Calculations", icon: "bi-calculator" },
  { href: "/payments", label: "Payments", icon: "bi-credit-card" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="bc-sidebar d-flex flex-column">
      <div className="brand">Bill<span>Core</span></div>
      <ul className="nav flex-column mt-2 flex-grow-1">
        {nav.map((item) => (
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
        v0.1.0
      </div>
    </nav>
  );
}
