"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { saveAuth, defaultPath, setPreferredLanguage } from "@/lib/auth";
import { useLanguage, setLanguage, t, SUPPORTED_LANGUAGES, LANGUAGE_FLAGS, type Language } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prefLang = (useLanguage() as Language) || "en";
    setLang(prefLang);
    document.documentElement.lang = prefLang;
  }, []);

  const submit = async () => {
    if (!form.username || !form.password) {
      setError(t("auth.username_required", lang));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login(form.username, form.password);
      const userLang = (res.user.preferred_language || lang) as Language;
      saveAuth(res.token, res.user);
      setPreferredLanguage(userLang);
      setLanguage(userLang);
      router.push(defaultPath());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
  };

  const handleLanguageChange = (newLang: string) => {
    const language = newLang as Language;
    setLang(language);
    setLanguage(language);
    document.documentElement.lang = language;
  };

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: "100vh", background: "#0f172a",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: "2.5rem",
        width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>
            Bill<span style={{ color: "#1a56db" }}>Core</span>
          </div>
          <div style={{ color: "#64748b", fontSize: "0.875rem", marginTop: 4 }}>
            {t("auth.signIn", lang)}
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2" style={{ fontSize: "0.875rem" }}>
            <i className="bi bi-exclamation-triangle me-2" />{error}
          </div>
        )}

        <div className="mb-3">
          <label className="form-label">{t("auth.username", lang)}</label>
          <input
            className="form-control"
            autoFocus
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            onKeyDown={handleKey}
          />
        </div>
        <div className="mb-4">
          <label className="form-label">{t("auth.password", lang)}</label>
          <input
            className="form-control"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            onKeyDown={handleKey}
          />
        </div>

        <div className="mb-4">
          <label className="form-label">{t("language.select", lang)}</label>
          <select
            className="form-select"
            value={lang}
            onChange={(e) => handleLanguageChange(e.target.value)}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_FLAGS[l]} {t(`language.${l}`, lang)}
              </option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-primary w-100"
          onClick={submit}
          disabled={loading}
        >
          {loading ? (
            <span className="spinner-border spinner-border-sm me-2" />
          ) : (
            <i className="bi bi-box-arrow-in-right me-2" />
          )}
          {t("auth.signin_button", lang)}
        </button>
      </div>
    </div>
  );
}
