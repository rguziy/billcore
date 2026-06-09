"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getUser, clearAuth } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

export default function Header() {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, [pathname]);

  const logout = () => {
    clearAuth();
    router.push("/login");
  };

  if (!mounted || !user || pathname === "/login") return null;

  return (
    <div style={{
      height: 52,
      background: "#fff",
      borderBottom: "1px solid #e2e8f0",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      padding: "0 1.5rem",
      gap: "1rem",
    }}>
      <div style={{ fontSize: "0.875rem", color: "#334155" }}>
        <i className="bi bi-person-circle me-1" />
        <strong>{user.username}</strong>
        <span className="ms-2 badge" style={{
          background: user.role === "admin" ? "#7c3aed22" : user.role === "manager" ? "#0891b222" : "#05966922",
          color: user.role === "admin" ? "#7c3aed" : user.role === "manager" ? "#0891b2" : "#059669",
          fontSize: "0.7rem",
        }}>
          {user.role}
        </span>
      </div>
      <button className="btn btn-sm btn-outline-secondary" onClick={logout}>
        <i className="bi bi-box-arrow-right me-1" />Logout
      </button>
    </div>
  );
}
