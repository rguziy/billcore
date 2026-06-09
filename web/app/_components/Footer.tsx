"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/login/") return null;

  const version = process.env.NEXT_PUBLIC_VERSION ?? "dev";
  const year    = new Date().getFullYear();

  return (
    <footer style={{
      borderTop: "1px solid #e2e8f0",
      background: "#fff",
      padding: "0.5rem 1.5rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: "0.75rem",
      color: "#94a3b8",
      flexShrink: 0,
    }}>
      <span>
        © {year}{" "}
        <a href="https://github.com/rguziy" target="_blank" rel="noopener noreferrer"
          style={{ color: "#64748b", textDecoration: "none" }}>
          Ruslan Huzii
        </a>
        {" "}— MIT License
      </span>
      <span style={{ color: "#cbd5e1" }}>
        BillCore {version}
      </span>
    </footer>
  );
}
