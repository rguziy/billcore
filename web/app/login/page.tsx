"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { saveAuth, defaultPath } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.username || !form.password) {
      setError("Username and password are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login(form.username, form.password);
      saveAuth(res.token, res.user);
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
            Sign in to your account
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2" style={{ fontSize: "0.875rem" }}>
            <i className="bi bi-exclamation-triangle me-2" />{error}
          </div>
        )}

        <div className="mb-3">
          <label className="form-label">Username</label>
          <input
            className="form-control"
            autoFocus
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            onKeyDown={handleKey}
          />
        </div>
        <div className="mb-4">
          <label className="form-label">Password</label>
          <input
            className="form-control"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            onKeyDown={handleKey}
          />
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
          Sign in
        </button>
      </div>
    </div>
  );
}
