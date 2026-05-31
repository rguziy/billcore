"use client";

import { useEffect, useState } from "react";
import { clientsApi } from "@/lib/api";
import type { Client, Payment } from "@/types";
import Alert from "@/app/_components/Alert";

export default function PaymentsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<number | "">("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientsApi.list().then(setClients).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedClient) { setPayments([]); return; }
    clientsApi.payments(Number(selectedClient))
      .then(setPayments)
      .catch((e) => setError(e.message));
  }, [selectedClient]);

  const methodLabel: Record<string, string> = {
    cash: "Cash", card: "Card", bank_transfer: "Bank transfer", online: "Online",
  };

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <div className="bc-page-header">
        <h1>Payments</h1>
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      <div className="bc-card">
        <div className="row g-2">
          <div className="col-md-4">
            <label className="form-label">Select client</label>
            <select className="form-select" value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value ? Number(e.target.value) : "")}>
              <option value="">— choose client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name} ({c.account_number})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedClient && (
        <>
          {payments.length > 0 && (
            <div className="bc-card py-2">
              <div className="d-flex gap-4">
                <div><span className="text-muted me-2">Payments:</span><strong>{payments.length}</strong></div>
                <div><span className="text-muted me-2">Total paid:</span><strong>{total.toFixed(2)}</strong></div>
              </div>
            </div>
          )}
          <div className="bc-card p-0">
            <table className="table bc-table mb-0">
              <thead>
                <tr>
                  <th className="ps-3">Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Calculation</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted p-4">No payments</td></tr>
                )}
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="ps-3">{new Date(p.paid_at).toLocaleDateString()}</td>
                    <td><strong>{p.amount.toFixed(2)}</strong></td>
                    <td>{methodLabel[p.method] ?? p.method}</td>
                    <td>{p.calculation_id ? `#${p.calculation_id}` : <span className="text-muted">Advance</span>}</td>
                    <td>{p.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
