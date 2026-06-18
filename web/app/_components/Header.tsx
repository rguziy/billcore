"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getUser, clearAuth } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { useLang } from "./LangProvider";
import { t, SUPPORTED_LANGUAGES, BRITISH_FLAG, UKRAINIAN_FLAG } from "@/lib/i18n";
import type { AuthUser } from "@/lib/auth";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, [pathname]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const closeDropdown = () => setDropdownOpen(false);
    window.addEventListener("click", closeDropdown);
    return () => window.removeEventListener("click", closeDropdown);
  }, [dropdownOpen]);

  const logout = () => {
    clearAuth();
    router.push("/login");
  };

  const handleLanguageChange = async (newLang: string) => {
    setLang(newLang as typeof lang);
    setDropdownOpen(false);
    try {
      await authApi.setLanguage(newLang);
    } catch (e) {
      console.error("Failed to save language preference", e);
    }
  };

  if (!mounted || !user || pathname === "/login") return null;

  return (
    <div style={{
      height: 52,
      background: "#fff",
      borderBottom: "1px solid #e2e8f0",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
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

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>

        <div className="dropdown" onClick={(e) => e.stopPropagation()} style={{ width: "140px" }}>
          <button
            className="form-control form-control-sm text-start d-flex align-items-center justify-content-between dropdown-toggle"
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{ cursor: "pointer", fontSize: "0.875rem" }}
            title={t("language.select", lang)}
          >
            <span className="d-flex align-items-center gap-2">
              <img
                src={lang === "uk" ? UKRAINIAN_FLAG : BRITISH_FLAG}
                alt={lang}
                style={{ width: "18px", height: "13px", objectFit: "cover", borderRadius: "1px" }}
              />
              <span>{t(`language.${lang}`, lang)}</span>
            </span>
          </button>

          <ul
            className={`dropdown-menu dropdown-menu-end shadow-sm ${dropdownOpen ? "show" : ""}`}
            style={{
              display: dropdownOpen ? "block" : "none",
              position: "absolute",
              zIndex: 1000,
              fontSize: "0.875rem",
              minWidth: "140px"
            }}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <li key={l}>
                <button
                  className={`dropdown-item d-flex align-items-center gap-2 ${lang === l ? "active" : ""}`}
                  type="button"
                  onClick={() => handleLanguageChange(l)}
                >
                  <img
                    src={l === "uk" ? UKRAINIAN_FLAG : BRITISH_FLAG}
                    alt={l}
                    style={{ width: "18px", height: "13px", objectFit: "cover", borderRadius: "1px" }}
                  />
                  <span>{t(`language.${l}`, lang)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button className="btn btn-sm btn-outline-secondary" onClick={logout}>
          <i className="bi bi-box-arrow-right me-1" />{t("header.logout", lang)}
        </button>
      </div>
    </div>
  );
}
