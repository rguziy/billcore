"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { periodsApi, calculationsApi, clientsApi, subscriptionsApi, servicesApi } from "@/lib/api";
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

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    subscription_id: "",
    reading_prev: "",
    reading_curr: "",
    quantity: "",
    note: "",
  });

  // delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // subscriptions for create modal (loaded from API when period client selected)
  const [subscriptions, setSubscriptions] = useState<{id: number; label: string; has_meter: boolean}[]>([]);

  // status-only modal (for locked period)
  const [statusId, setStatusId]   = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState<CalculationStatus>("paid");

  useEffect(() => {
    Promise.all([periodsApi.list(), clientsApi.list()])
      .then(([p, c]) => {
        setPeriods(p);
        setClients(c);
        // auto-select open period if no period in URL
        if (!searchParams.get("period_id") && p.length > 0) {
          const open = p.find((x) => x.status === "open") ?? p[0];
          const params = new URLSearchParams(searchParams.toString());
          params.set("period_id", String(open.id));
          router.replace(`/calculations?${params.toString()}`);
        }
      })
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

  // Load subscriptions for create modal — exclude those already in calculations for this period
  useEffect(() => {
    if (!clientId) { setSubscriptions([]); return; }
    subscriptionsApi.listAll().then(async (subs) => {
      const svcs = await servicesApi.list();
      const locs = await clientsApi.listLocations(Number(clientId));
      const locIds = new Set(locs.map((l) => l.id));
      const filtered = subs.filter((s) => locIds.has(s.location_id));
      const svcMap = Object.fromEntries(svcs.map((s) => [s.id, s]));
      const locMap = Object.fromEntries(locs.map((l) => [l.id, l]));

      // exclude subscriptions that already have a calculation in current period
      const existingSubIds = new Set(calcs.map((c) => c.subscription_id));

      setSubscriptions(
        filtered
          .filter((s) => !existingSubIds.has(s.id))
          .map((s) => ({
            id: s.id,
            label: `${svcMap[s.service_id]?.name ?? "?"} — ${locMap[s.location_id]?.name ?? "?"}`,
            has_meter: svcMap[s.service_id]?.has_meter ?? false,
          }))
      );
    }).catch((e) => setError(e.message));
  }, [clientId, calcs]);

  const openCreate = () => {
    setCreateForm({ subscription_id: "", reading_prev: "", reading_curr: "", quantity: "", note: "" });
    setShowCreate(true);
  };

  const saveCreate = async () => {
    if (!periodId || !createForm.subscription_id) return;
    try {
      const sub = subscriptions.find((s) => s.id === Number(createForm.subscription_id));
      await calculationsApi.create(Number(periodId), {
        subscription_id: Number(createForm.subscription_id),
        reading_prev:  createForm.reading_prev !== "" ? Number(createForm.reading_prev) : undefined,
        reading_curr:  createForm.reading_curr !== "" ? Number(createForm.reading_curr) : undefined,
        quantity:      !sub?.has_meter && createForm.quantity !== "" ? Number(createForm.quantity) : undefined,
        note:          createForm.note,
      });
      setShowCreate(false);
      reload();
    } catch (e: any) { setError(e.message); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await calculationsApi.delete(deleteId);
      setDeleteId(null);
      reload();
    } catch (e: any) { setError(e.message); }
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
  const needsReading = calcs.filter((c) => c.reading_prev != null && c.reading_curr == null).length;

  return (
    <>
      <div className="bc-page-header">
        <h1>Calculations</h1>
        <div className="d-flex align-items-center gap-2">
          {currentPeriod && (
            <span className={`badge fs-6 ${currentPeriod.status === "open" ? "badge-paid" : "badge-cancelled"}`}>
              <i className={`bi bi-${currentPeriod.status === "open" ? "unlock" : "lock"} me-1`} />
              {currentPeriod.status === "open" ? "Open" : "Closed"}
            </span>
          )}
          {!isLocked && periodId && (
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <i className="bi bi-plus-lg me-1" /> Add Calculation
            </button>
          )}
        </div>
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
            <div className="col-12 mt-2">
              <div className="d-flex gap-4">
                <div>
                  <span className="text-muted me-1" style={{ fontSize: "0.8rem" }}>Total accrued:</span>
                  <strong>{calcs.reduce((s, c) => s + c.amount, 0).toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-muted me-1" style={{ fontSize: "0.8rem" }}>Paid:</span>
                  <strong style={{ color: "#059669" }}>
                    {calcs.filter((c) => c.status === "paid").reduce((s, c) => s + c.amount, 0).toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span className="text-muted me-1" style={{ fontSize: "0.8rem" }}>Pending:</span>
                  <strong style={{ color: "#dc2626" }}>
                    {calcs.filter((c) => c.status === "pending").reduce((s, c) => s + c.amount, 0).toFixed(2)}
                  </strong>
                </div>
                {needsReading > 0 && (
                  <span className="badge badge-pending align-self-center">
                    <i className="bi bi-exclamation-triangle me-1" />{needsReading} need reading
                  </span>
                )}
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
                          <div className="d-flex gap-1 justify-content-end">
                            <button className="btn btn-sm btn-outline-primary" title="Edit"
                              onClick={() => openEdit(c)}>
                              <i className="bi bi-pencil" />
                            </button>
                            <button className="btn btn-sm btn-outline-danger" title="Delete"
                              onClick={() => setDeleteId(c.id)}>
                              <i className="bi bi-trash" />
                            </button>
                          </div>
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

      {/* Create modal */}
      <Modal title="Add Calculation" show={showCreate} onClose={() => setShowCreate(false)}
        onConfirm={saveCreate} confirmLabel="Create">
        <div className="mb-3">
          <label className="form-label">Subscription *</label>
          <select className="form-select" value={createForm.subscription_id}
            onChange={(e) => {
              const subId = e.target.value;
              const sub = subscriptions.find((s) => s.id === Number(subId));
              setCreateForm({
                subscription_id: subId,
                reading_prev: "0",
                reading_curr: "0",
                quantity: sub?.has_meter ? "" : "1",
                note: "",
              });
            }}>
            <option value="">— select subscription —</option>
            {subscriptions.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {subscriptions.length === 0 && (
            <div className="form-text text-warning">
              {clientId ? "All subscriptions already have calculations for this period." : "Select a client filter first."}
            </div>
          )}
        </div>
        {(() => {
          const sub = subscriptions.find((s) => s.id === Number(createForm.subscription_id));
          return sub?.has_meter ? (
            <>
              <div className="mb-3">
                <label className="form-label">Previous reading</label>
                <input className="form-control" type="number" step="0.001"
                  value={createForm.reading_prev}
                  onChange={(e) => {
                    const prev = e.target.value;
                    setCreateForm((f) => ({
                      ...f,
                      reading_prev: prev,
                      // keep curr in sync if user hasn't changed it yet
                      reading_curr: f.reading_curr === f.reading_prev ? prev : f.reading_curr,
                    }));
                  }}
                  placeholder="0" />
              </div>
              <div className="mb-3">
                <label className="form-label">Current reading *</label>
                <input className="form-control" type="number" step="0.001"
                  value={createForm.reading_curr}
                  onChange={(e) => setCreateForm({ ...createForm, reading_curr: e.target.value })} />
                {createForm.reading_curr !== "" && (
                  <div className="form-text">
                    Quantity: <strong>
                      {Math.max(0, Number(createForm.reading_curr) - Number(createForm.reading_prev || 0)).toFixed(3)}
                    </strong>
                  </div>
                )}
              </div>
            </>
          ) : sub ? (
            <div className="mb-3">
              <label className="form-label">Quantity</label>
              <input className="form-control" type="number" step="0.01"
                value={createForm.quantity}
                onChange={(e) => setCreateForm({ ...createForm, quantity: e.target.value })} />
            </div>
          ) : null;
        })()}
        <div className="mb-3">
          <label className="form-label">Note</label>
          <input className="form-control" value={createForm.note}
            onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })} />
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal title="Delete Calculation" show={deleteId !== null}
        onClose={() => setDeleteId(null)} onConfirm={confirmDelete}
        confirmLabel="Delete" confirmVariant="danger">
        <p>Are you sure you want to delete this calculation?</p>
        <p className="text-muted mb-0" style={{ fontSize: "0.875rem" }}>
          This is only possible if no payments reference it and the period is open.
        </p>
      </Modal>

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
