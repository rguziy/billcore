"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken, getUser, defaultPath } from "@/lib/auth";

const managerPages = ["/statistics", "/services", "/periods"];
const adminPages   = ["/users"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (pathname === "/login" || pathname === "/login/") {
      setReady(true);
      return;
    }

    const token = getToken();
    if (!token) {
      router.replace("/login");
      return; // don't set ready — show nothing until redirect
    }

    const role = getUser()?.role ?? "operator";

    // Role-based page access
    if (adminPages.some((p) => pathname.startsWith(p)) && role !== "admin") {
      router.replace(defaultPath());
      return;
    }
    if (managerPages.some((p) => pathname.startsWith(p)) && role === "operator") {
      router.replace(defaultPath());
      return;
    }

    // Dashboard → redirect to role default page
    if (pathname === "/" || pathname === "//") {
      router.replace(defaultPath());
      return;
    }

    setReady(true);
  }, [pathname]);

  if (!ready) return null;
  return <>{children}</>;
}
