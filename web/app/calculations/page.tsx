"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { periodsApi, calculationsApi, clientsApi } from "@/lib/api";
import type { Calculation, Period, Client, CalculationStatus } from "@/types";
import Alert from "@/app/_components/Alert";
import Modal from "@/app/_components/Modal";

const statusColor: Record<CalculationStatus, string> = {
  pending: "badge-pending",
  paid: "badge-paid",
  cancelled: "badge-cancelled",
};

function CalculationsContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [periods, setPeriods]   = useState<Period[]>([]);
  const [clients, setClients]   = useState<Client[]>([]);
  const [calcs, setCalcs]       = useState<Calculation[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const periodId = searchParams.get("period_id") ? Number(searchParams.get("period_id")) : "";
  const clientId = searchParams.get("client_id") ? Number(searchParams.get("client_id")) : "";

  // selected period (to know if it's open/closed)
  const [currentPeriod, setCurrentPeriod] = useState<Period | null>(null);

  // edit reading modal
  const [readingId, setReadingId]     = useState<number | null>(null);
  const [readingVal, setReadingVal]   = useState(0);

  // edit status modal
  const [statusId, setStatusId]       = useState<number | null>(null);
  const [newStatus, setNewStatus]     = useState<CalculationStatus>("paid");

  // edit note modal
  const [noteId, setNoteId]           = useState<number | null>(null);
  const [noteVal, setNoteVal]         = useState("");

  useEffect(() => {
    Promise.all([periodsApi.list(), clientsApi.list()])
      .then(([p, c]) => { setPeriods(p); setClients(c); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!periodId) { setCalcs([]); setCurrentPeriod(null); return; }
    setLoading(true);
    const cp = periods.find((p) => p.id === periodId) ?? null;
    setCurrentPeriod(cp);
    periodsApi.getCalculations(Number(periodId), clientId ? Number(clientId) : undefined)
      .then(setCalcs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [periodId, clientId, periods]);

  const setParam = (key: string, val: string | number | "") => {
    const p = new URLSearchParams(searchParams.toString());
    if (val === "") p.delete(key); else p.set(key, String(val));
    router.push(`/calculations?${p.toString()}`);
  };

  const reload = () => {
    if (!periodId) return;
    periodsApi.getCalculations(Number(periodId), clientId ? Number(clientId) : undefined)
      .then(setCalcs).catch((e) => setError(e.message));
  };

  const saveReading = async () => {
    if (!readingId) return;
    try {
      await calculationsApi.updateReading(readingId, readingVal);
      setReadingId(null);
      reload();
    } catch (e: any) { setError(e.message); }
  };

  const saveStatus = async () => {
    if (!statusId) return;
    try {
      await calculationsApi.updateStatus(statusId, newStatus);
      setStatusId(null);
      reload();
    } catch (e: any) { setError(e.message); }
  };

  const saveNote = async () => {
    if (!noteId) return;
    try {
      await calculationsApi.updateNote(noteId, noteVal);
      setNoteId(null);
      reload();
    } catch (e: any) { setError(e.message); }
  };

  const isLocked = currentPeriod?.status === "closed";
  const total    = calcs.reduce((s, c) => s + c.amount, 0);

  return (
    <>
      <div className="bc-page-header">
        <h1>Calculations</h1>
        {currentPeriod && (
          <span className={`badge fs-6 ${currentPeriod.status === "open" ? "badge-paid" : "badge-cancelled"}`}>
            <i className={`bi bi-${currentPeriod.status === "open" ? "unlock" : "lock"} me-1`} />
            {currentPeriod.status === "open" ? "Open" : "Closed"}
          </span>
        )}
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      {/* Filters */}
      <div className="bc-card">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Period *</label>
            <select className="form-select" value={periodId}
              onChange={(e) => setParam("period_id", e.target.value)}>
              <option value="">— select period —</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {new Date(p.period_start).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                  {p.status === "closed" ? " 🔒" : " 🔓"}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Client</label>
            <select className="form-select" value={clientId}
              onChange={(e) => setParam("client_id", e.target.value)}>
              <option value="">— all clients —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name} ({c.account_number})</option>
              ))}
            </select>
          </div>
          {calcs.length > 0 && (
            <div className="col-md-4">
              <div className="d-flex gap-3 pb-1">
                <div><span className="text-muted me-1">Rows:</span><strong>{calcs.length}</strong></div>
                <div><span className="text-muted me-1">Total:</span><strong>{total.toFixed(2)}</strong></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {periodId && (
        <div className="bc-card p-0">
          {loading ? (
            <div className="p-4 text-center text-muted">Loading...</div>
          ) : (
            <table className="table bc-table mb-0">
              <thead>
                <tr>
                  <th className="ps-3">Sub #</th>
                  <th>Prev reading</th>
                  <th>Curr reading</th>
                  <th>Quantity</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Note</th>
                  {!isLocked && <th></th>}
                </tr>
              </thead>
              <tbody>
                {calcs.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted p-4">No calculations</td></tr>
                )}
                {calcs.map((c) => (
                  <tr key={c.id} style={c.reading_curr === undefined && c.amount === 0 ? { background: "#fffbeb" } : {}}>
                    <td className="ps-3">
                      <code style={{ fontSize: "0.8rem" }}>#{c.subscription_id}</code>
                    </td>
                    <td>{c.reading_prev != null ? c.reading_prev : "—"}</td>
                    <td>
                      {c.reading_curr != null
                        ? c.reading_curr
                        : <span className="text-warning fw-semibold">— enter reading</span>}
                    </td>
                    <td>{c.quantity}</td>
                    <td><strong>{c.amount.toFixed(2)}</strong></td>
                    <td>
                      <span className={`badge ${statusColor[c.status]}`}>{c.status}</span>
                    </td>
                    <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.note || "—"}
                    </td>
                    {!isLocked && (
                      <td className="text-end pe-3">
                        {c.reading_prev != null && (
                          <button className="btn btn-sm btn-outline-primary me-1" title="Enter reading"
                            onClick={() => { setReadingId(c.id); setReadingVal(c.reading_curr ?? c.reading_prev ?? 0); }}>
                            <i className="bi bi-input-cursor-text" />
                          </button>
                        )}
                        <button className="btn btn-sm btn-outline-secondary me-1" title="Change status"
                          onClick={() => { setStatusId(c.id); setNewStatus(c.status); }}>
                          <i className="bi bi-arrow-repeat" />
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" title="Edit note"
                          onClick={() => { setNoteId(c.id); setNoteVal(c.note ?? ""); }}>
                          <i className="bi bi-chat-left-text" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Reading modal */}
      <Modal title="Enter Meter Reading" show={readingId !== null}
        onClose={() => setReadingId(null)} onConfirm={saveReading} confirmLabel="Save">
        <div className="mb-3">
          <label className="form-label">Current reading *</label>
          <input className="form-control" type="number" step="0.001" value={readingVal}
            onChange={(e) => setReadingVal(Number(e.target.value))} />
          <div className="form-text">Quantity and amount will be recalculated automatically.</div>
        </div>
      </Modal>

      {/* Status modal */}
      <Modal title="Update Status" show={statusId !== null}
        onClose={() => setStatusId(null)} onConfirm={saveStatus} confirmLabel="Update">
        <div className="mb-3">
          <label className="form-label">New status</label>
          <select className="form-select" value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as CalculationStatus)}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </Modal>

      {/* Note modal */}
      <Modal title="Edit Note" show={noteId !== null}
        onClose={() => setNoteId(null)} onConfirm={saveNote} confirmLabel="Save">
        <div className="mb-3">
          <label className="form-label">Note</label>
          <input className="form-control" value={noteVal}
            onChange={(e) => setNoteVal(e.target.value)}
            placeholder="e.g. paid until 2026-09-01" />
        </div>
      </Modal>
    </>
  );
}

export default function CalculationsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-muted">Loading...</div>}>
      <CalculationsContent />
    </Suspense>
  );
}
