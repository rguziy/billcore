"use client";

import { useEffect, useState } from "react";
import { calculationsApi, clientsApi } from "@/lib/api";
import type { Calculation, Client, CalculationStatus } from "@/types";
import Alert from "@/app/_components/Alert";
import Modal from "@/app/_components/Modal";

export default function CalculationsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<number | "">("");
  const [calcs, setCalcs] = useState<Calculation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState<CalculationStatus>("paid");

  useEffect(() => {
    clientsApi.list().then(setClients).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedClient) { setCalcs([]); return; }
    clientsApi.pending(Number(selectedClient))
      .then(setCalcs)
      .catch((e) => setError(e.message));
  }, [selectedClient]);

  const updateStatus = async () => {
    if (!statusId) return;
    try {
      await calculationsApi.updateStatus(statusId, newStatus);
      setStatusId(null);
      if (selectedClient) {
        setCalcs(await clientsApi.pending(Number(selectedClient)));
      }
    } catch (e: any) { setError(e.message); }
  };

  const statusColor: Record<CalculationStatus, string> = {
    pending: "badge-pending",
    paid: "badge-paid",
    cancelled: "badge-cancelled",
  };

  return (
    <>
      <div className="bc-page-header">
        <h1>Calculations</h1>
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      <div className="bc-card">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Select client</label>
            <select className="form-select" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value ? Number(e.target.value) : "")}>
              <option value="">— choose client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name} ({c.account_number})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedClient && (
        <div className="bc-card p-0">
          <table className="table bc-table mb-0">
            <thead>
              <tr>
                <th className="ps-3">Period</th>
                <th>Quantity</th>
                <th>Prev reading</th>
                <th>Curr reading</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {calcs.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted p-4">No pending calculations</td></tr>
              )}
              {calcs.map((c) => (
                <tr key={c.id}>
                  <td className="ps-3">
                    {new Date(c.period_start).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                  </td>
                  <td>{c.quantity}</td>
                  <td>{c.reading_prev ?? "—"}</td>
                  <td>{c.reading_curr ?? "—"}</td>
                  <td><strong>{c.amount.toFixed(2)}</strong></td>
                  <td><span className={`badge ${statusColor[c.status]}`}>{c.status}</span></td>
                  <td>{c.note || "—"}</td>
                  <td className="pe-3">
                    <button className="btn btn-sm btn-outline-secondary"
                      onClick={() => { setStatusId(c.id); setNewStatus("paid"); }}>
                      <i className="bi bi-pencil" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal title="Update status" show={statusId !== null} onClose={() => setStatusId(null)} onConfirm={updateStatus} confirmLabel="Update">
        <div className="mb-3">
          <label className="form-label">New status</label>
          <select className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value as CalculationStatus)}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </Modal>
    </>
  );
}
