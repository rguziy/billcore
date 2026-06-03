"use client";

import { useEffect, useState } from "react";
import { periodsApi } from "@/lib/api";
import type { Period, OpenPeriodResponse } from "@/types";
import Alert from "@/app/_components/Alert";
import Modal from "@/app/_components/Modal";
import Link from "next/link";

function firstOfCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function PeriodsPage() {
  const [periods, setPeriods]   = useState<Period[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  const [showOpen, setShowOpen]   = useState(false);
  const [openDate, setOpenDate]   = useState(firstOfCurrentMonth());

  const [closeId, setCloseId]   = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = async () => {
    try { setPeriods(await periodsApi.list()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openPeriod = async () => {
    try {
      const res: OpenPeriodResponse = await periodsApi.open(openDate);
      setShowOpen(false);
      setSuccess(`Period opened. ${res.generated} calculation(s) generated.`);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const closePeriod = async () => {
    if (!closeId) return;
    try {
      await periodsApi.close(closeId);
      setCloseId(null);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const reopenPeriod = async (id: number) => {
    try {
      await periodsApi.reopen(id);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const deletePeriod = async () => {
    if (!deleteId) return;
    try {
      await periodsApi.delete(deleteId);
      setDeleteId(null);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <div className="bc-page-header">
        <h1>Billing Periods</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowOpen(true)}>
          <i className="bi bi-calendar-plus me-1" /> Open Period
        </button>
      </div>

      {success && (
        <div className="alert alert-success alert-dismissible">
          <i className="bi bi-check-circle me-2" />{success}
          <button className="btn-close" onClick={() => setSuccess(null)} />
        </div>
      )}
      <Alert message={error} onClose={() => setError(null)} />

      <div className="bc-card p-0">
        {loading ? (
          <div className="p-4 text-center text-muted">Loading...</div>
        ) : (
          <table className="table bc-table mb-0">
            <thead>
              <tr>
                <th className="ps-3">Period</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {periods.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted p-4">No periods yet</td></tr>
              )}
              {periods.map((p) => (
                <tr key={p.id}>
                  <td className="ps-3">
                    <Link href={`/calculations?period_id=${p.id}`} className="fw-semibold text-decoration-none">
                      {new Date(p.period_start).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                    </Link>
                  </td>
                  <td>{fmt(p.period_start)}</td>
                  <td>{fmt(p.period_end)}</td>
                  <td>
                    {p.status === "open"
                      ? <span className="badge badge-paid"><i className="bi bi-unlock me-1" />Open</span>
                      : <span className="badge badge-cancelled"><i className="bi bi-lock me-1" />Closed</span>}
                  </td>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="text-end pe-3">
                    <Link href={`/calculations?period_id=${p.id}`}
                      className="btn btn-sm btn-outline-primary me-1" title="View calculations">
                      <i className="bi bi-table" />
                    </Link>
                    {p.status === "open" ? (
                      <button className="btn btn-sm btn-outline-warning me-1" title="Close period"
                        onClick={() => setCloseId(p.id)}>
                        <i className="bi bi-lock" />
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-outline-secondary me-1" title="Reopen period"
                        onClick={() => reopenPeriod(p.id)}>
                        <i className="bi bi-unlock" />
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-danger" title="Delete"
                      onClick={() => setDeleteId(p.id)}>
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Open period modal */}
      <Modal title="Open Billing Period" show={showOpen} onClose={() => setShowOpen(false)}
        onConfirm={openPeriod} confirmLabel="Open & Generate">
        <p className="text-muted" style={{ fontSize: "0.875rem" }}>
          Opening a period will automatically create calculations for all active subscriptions.
          Meter readings will need to be entered manually.
        </p>
        <div className="mb-3">
          <label className="form-label">Period start (1st of month) *</label>
          <input className="form-control" type="date" value={openDate}
            onChange={(e) => setOpenDate(e.target.value)} />
        </div>
      </Modal>

      {/* Close confirm */}
      <Modal title="Close Period" show={closeId !== null} onClose={() => setCloseId(null)}
        onConfirm={closePeriod} confirmLabel="Close Period" confirmVariant="warning">
        <p>Closing this period will <strong>lock all calculations</strong> and prevent further edits.</p>
        <p className="text-muted mb-0" style={{ fontSize: "0.875rem" }}>You can reopen it later if needed.</p>
      </Modal>

      {/* Delete confirm */}
      <Modal title="Delete Period" show={deleteId !== null} onClose={() => setDeleteId(null)}
        onConfirm={deletePeriod} confirmLabel="Delete" confirmVariant="danger">
        This will delete the period and all its calculations. This action cannot be undone.
      </Modal>
    </>
  );
}
