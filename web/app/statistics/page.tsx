"use client";

import { useEffect, useState } from "react";
import { statisticsApi, periodsApi } from "@/lib/api";
import Alert from "@/app/_components/Alert";
import Link from "next/link";

type Stats = Awaited<ReturnType<typeof statisticsApi.get>>;

function StatCard({ title, children, color = "#1a56db" }: {
  title: string; children: React.ReactNode; color?: string;
}) {
  return (
    <div className="bc-card h-100">
      <div style={{
        fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em",
        color: "#64748b", fontWeight: 600, marginBottom: "1rem",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, color = "#0f172a", sub }: {
  label: string; value: string | number; color?: string; sub?: string;
}) {
  return (
    <div className="d-flex justify-content-between align-items-baseline mb-2">
      <span style={{ fontSize: "0.875rem", color: "#475569" }}>{label}</span>
      <div className="text-end">
        <strong style={{ fontSize: "1.1rem", color }}>{value}</strong>
        {sub && <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function StatisticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statisticsApi.get()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4 text-center text-muted">Loading statistics...</div>;

  return (
    <>
      <div className="bc-page-header">
        <h1>Statistics</h1>
        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
          <i className="bi bi-clock me-1" />
          {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </span>
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      {stats && (
        <>
          <div className="row g-3 mb-3">
            {/* Clients */}
            <div className="col-md-4">
              <StatCard title="Clients">
                <Metric label="Total" value={stats.clients.total} />
                <Metric label="Active"   value={stats.clients.active}   color="#059669" />
                <Metric label="Inactive" value={stats.clients.inactive} color="#dc2626" />
                <div className="mt-3">
                  <Link href="/clients" className="btn btn-sm btn-outline-primary w-100">
                    <i className="bi bi-people me-1" />Manage clients
                  </Link>
                </div>
              </StatCard>
            </div>

            {/* Users */}
            <div className="col-md-4">
              <StatCard title="Users">
                <Metric label="Total"     value={stats.users.total} />
                <Metric label="Admins"    value={stats.users.admins}    color="#7c3aed" />
                <Metric label="Managers"  value={stats.users.managers}  color="#0891b2" />
                <Metric label="Operators" value={stats.users.operators} color="#059669" />
                <div className="mt-3">
                  <Link href="/users" className="btn btn-sm btn-outline-primary w-100">
                    <i className="bi bi-person-gear me-1" />Manage users
                  </Link>
                </div>
              </StatCard>
            </div>

            {/* Services */}
            <div className="col-md-4">
              <StatCard title="Services">
                <Metric label="Total" value={stats.services.total} />
                <Metric
                  label="No active tariff"
                  value={stats.services.without_tariff}
                  color={stats.services.without_tariff > 0 ? "#dc2626" : "#059669"}
                  sub={stats.services.without_tariff > 0 ? "⚠ calculations blocked" : "✓ all good"}
                />
                <div className="mt-3">
                  <Link href="/services" className="btn btn-sm btn-outline-primary w-100">
                    <i className="bi bi-grid me-1" />Manage services
                  </Link>
                </div>
              </StatCard>
            </div>
          </div>

          {/* Current period */}
          {stats.current_period && (
            <div className="bc-card">
              <div style={{
                fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em",
                color: "#64748b", fontWeight: 600, marginBottom: "1rem",
              }}>
                Current period — {new Date(stats.current_period.period_start).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
              </div>
              <div className="row g-3">
                <div className="col-6 col-md-3">
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>
                      {stats.current_period.accrued.toFixed(2)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Total accrued</div>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#059669" }}>
                      {stats.current_period.paid.toFixed(2)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Paid</div>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#dc2626" }}>
                      {stats.current_period.pending.toFixed(2)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Pending</div>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#94a3b8" }}>
                      {stats.current_period.cancelled.toFixed(2)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Cancelled</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 text-center">
                <Link href={`/calculations?period_id=${stats.current_period.period_id}`}
                  className="btn btn-sm btn-outline-primary">
                  <i className="bi bi-calculator me-1" />View calculations
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
