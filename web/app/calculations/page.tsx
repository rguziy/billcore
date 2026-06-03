"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { periodsApi, calculationsApi, clientsApi } from "@/lib/api";
import type { CalculationRow, Period, Client, CalculationStatus } from "@/types";
import Alert from "@/app/_components/Alert";
import Modal from "@/app/_components/Modal";

const statusColor: Record<CalculationStatus, string> = {
  pending:   "badge-pending",
  paid:      "badge-paid",
  cancelled: "badge-cancelled",
};

function CalculationsContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [periods, setPeriods] = useState<Period[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [calcs, setCalcs]     = useState<CalculationRow[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState<Period | null>(null);

  const periodId = searchParams.get("period_id") ? Number(searchParams.get("period_id")) : "";
  const clientId = searchParams.get("client_id") ? Number(searchParams.get("client_id")) : "";

  // edit modal
  const [editCalc, setEditCalc] = useState<CalculationRow | null>(null);
  const [editForm, setEditForm] = useState({
    reading_prev: "",
    reading_curr: "",
    status: "pending" as CalculationStatus,
    note: "",
  });

  // status-only modal (for locked period — only paying)
  const [statusId, setStatusId]   = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState<CalculationStatus>("paid");

  useEffect(() => {
    Promise.all([periodsApi.list(), clientsApi.list()])
      .then(([p, c]) => { setPeriods(p); setClients(c); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!periodId) { setCalcs([]); setCurrentPeriod(null); return; }
    const cp = periods.find((p) => p.id === periodId) ?? null;
    setCurrentPeriod(cp);
    setLoading(true);
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

  const openEdit = (c: CalculationRow) => {
    setEditCalc(c);
    setEditForm({
      reading_prev: c.reading_prev != null ? String(c.reading_prev) : "",
      reading_curr: c.reading_curr != null ? String(c.reading_curr) : "",
      status: c.status,
      note: c.note ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editCalc) return;
    try {
      const promises: Promise<void>[] = [];

      // update reading if service has meter and curr is provided
      if (editCalc.has_meter && editForm.reading_curr !== "") {
        const prev = editForm.reading_prev !== "" ? Number(editForm.reading_prev) : undefined;
        promises.push(
          calculationsApi.updateReading(editCalc.id, Number(editForm.reading_curr), prev)
        );
      }
      // update status if changed
      if (editForm.status !== editCalc.status) {
        promises.push(calculationsApi.updateStatus(editCalc.id, editForm.status));
      }
      // update note if changed
      if (editForm.note !== (editCalc.note ?? "")) {
        promises.push(calculationsApi.updateNote(editCalc.id, editForm.note));
      }

      await Promise.all(promises);
      setEditCalc(null);
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

  const isLocked = currentPeriod?.status === "closed";
  const total    = calcs.reduce((s, c) => s + c.amount, 0);
  const needsReading = calcs.filter((c) => c.reading_prev != null && c.reading_curr == null).length;

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
            <div className="col-md-4 d-flex gap-3 pb-1 align-items-end">
              <div><span className="text-muted me-1">Rows:</span><strong>{calcs.length}</strong></div>
              <div><span className="text-muted me-1">Total:</span><strong>{total.toFixed(2)}</strong></div>
              {needsReading > 0 && (
                <span className="badge badge-pending">
                  <i className="bi bi-exclamation-triangle me-1" />{needsReading} need reading
                </span>
              )}
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
                  <th className="ps-3">Service</th>
                  <th>Location</th>
                  <th>Prev</th>
                  <th>Curr</th>
                  <th>Qty</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {calcs.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-muted p-4">No calculations</td></tr>
                )}
                {calcs.map((c) => {
                  const missingReading = c.reading_prev != null && c.reading_curr == null;
                  return (
                    <tr key={c.id} style={missingReading ? { background: "#fffbeb" } : {}}>
                      <td className="ps-3 fw-semibold">
                        {c.service_name}
                        <span className="text-muted ms-1" style={{ fontSize: "0.75rem" }}>({c.unit})</span>
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "#64748b" }}>{c.location_name}</td>
                      <td>{c.reading_prev != null ? c.reading_prev : <span className="text-muted">—</span>}</td>
                      <td>
                        {c.reading_curr != null
                          ? c.reading_curr
                          : c.reading_prev != null
                            ? <span className="text-warning fw-semibold">enter ↓</span>
                            : <span className="text-muted">—</span>}
                      </td>
                      <td>{c.quantity}</td>
                      <td><strong>{c.amount.toFixed(2)}</strong></td>
                      <td><span className={`badge ${statusColor[c.status]}`}>{c.status}</span></td>
                      <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.note || <span className="text-muted">—</span>}
                      </td>
                      <td className="text-end pe-3">
                        {!isLocked ? (
                          <button className="btn btn-sm btn-outline-primary" title="Edit"
                            onClick={() => openEdit(c)}>
                            <i className="bi bi-pencil" />
                          </button>
                        ) : (
                          <button className="btn btn-sm btn-outline-secondary" title="Mark as paid"
                            onClick={() => { setStatusId(c.id); setNewStatus("paid"); }}>
                            <i className="bi bi-cash" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Edit modal */}
      <Modal title={`Edit — ${editCalc?.service_name ?? ""}`}
        show={editCalc !== null} onClose={() => setEditCalc(null)} onConfirm={saveEdit}>
        {editCalc?.has_meter && (
          <>
            <div className="mb-3">
              <label className="form-label">
                Previous reading
                {editCalc.reading_prev == null && <span className="text-muted ms-1" style={{fontSize:"0.8rem"}}>(first period — enter manually)</span>}
              </label>
              <input className="form-control" type="number" step="0.001"
                value={editForm.reading_prev}
                onChange={(e) => setEditForm({ ...editForm, reading_prev: e.target.value })}
                disabled={editCalc.reading_prev != null}
                placeholder={editCalc.reading_prev == null ? "Enter previous reading" : ""}
              />
              {editCalc.reading_prev != null && (
                <div className="form-text">Set automatically from the previous period.</div>
              )}
            </div>
            <div className="mb-3">
              <label className="form-label">Current reading *</label>
              <input className="form-control" type="number" step="0.001"
                value={editForm.reading_curr}
                onChange={(e) => setEditForm({ ...editForm, reading_curr: e.target.value })}
                placeholder="Enter current meter reading"
                autoFocus={editCalc.reading_prev != null}
              />
              {editForm.reading_curr !== "" && (
                <div className="form-text">
                  Quantity: <strong>
                    {Math.max(0, Number(editForm.reading_curr) - Number(editForm.reading_prev || 0)).toFixed(3)}
                  </strong> {editCalc.unit}
                </div>
              )}
            </div>
          </>
        )}
        <div className="mb-3">
          <label className="form-label">Status</label>
          <select className="form-select" value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value as CalculationStatus })}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Note</label>
          <input className="form-control" value={editForm.note}
            onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
            placeholder="e.g. paid until 2026-09-01" />
        </div>
      </Modal>

      {/* Quick status modal (closed period) */}
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
