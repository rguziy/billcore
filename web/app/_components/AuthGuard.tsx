"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken, getUser, defaultPath } from "@/lib/auth";

// Pages restricted to manager+
const managerPages = ["/statistics", "/services", "/periods"];
// Pages restricted to admin only
const adminPages   = ["/users"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (pathname === "/login") { setReady(true); return; }

    const token = getToken();
    if (!token) { router.replace("/login"); return; }

    const user = getUser();
    const role = user?.role ?? "operator";

    // Check page access
    const isAdminPage   = adminPages.some((p) => pathname.startsWith(p));
    const isManagerPage = managerPages.some((p) => pathname.startsWith(p));

    if (isAdminPage && role !== "admin") {
      router.replace(defaultPath());
      return;
    }
    if (isManagerPage && role === "operator") {
      router.replace(defaultPath());
      return;
    }

    setReady(true);
  }, [pathname]);

  if (!ready) return null;
  return <>{children}</>;
}
