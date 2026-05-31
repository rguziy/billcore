"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { clientsApi } from "@/lib/api";
import type { Client, Location, ClientBalance, Calculation, Payment } from "@/types";
import Modal from "@/app/_components/Modal";
import Alert from "@/app/_components/Alert";
import Link from "next/link";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);

  const [client, setClient] = useState<Client | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [balance, setBalance] = useState<ClientBalance | null>(null);
  const [pending, setPending] = useState<Calculation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showLocModal, setShowLocModal] = useState(false);
  const [locForm, setLocForm] = useState({ name: "", address: "", is_default: false });

  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: 0, method: "cash", note: "" });

  const load = async () => {
    try {
      const [c, locs, bal, pend, pays] = await Promise.all([
        clientsApi.get(clientId),
        clientsApi.listLocations(clientId),
        clientsApi.balance(clientId),
        clientsApi.pending(clientId),
        clientsApi.payments(clientId),
      ]);
      setClient(c); setLocations(locs); setBalance(bal); setPending(pend); setPayments(pays);
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { load(); }, [clientId]);

  const saveLocation = async () => {
    try {
      await clientsApi.createLocation(clientId, locForm);
      setShowLocModal(false);
      setLocForm({ name: "", address: "", is_default: false });
      load();
    } catch (e: any) { setError(e.message); }
  };

  const savePayment = async () => {
    try {
      await clientsApi.createPayment(clientId, payForm as any);
      setShowPayModal(false);
      setPayForm({ amount: 0, method: "cash", note: "" });
      load();
    } catch (e: any) { setError(e.message); }
  };

  if (!client) return <div className="text-center p-5 text-muted">Loading...</div>;

  return (
    <>
      <div className="bc-page-header">
        <div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
            <Link href="/clients" className="text-decoration-none">Clients</Link> / {client.full_name}
          </div>
          <h1>{client.full_name}</h1>
        </div>
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      <div className="row g-3 mb-3">
        {/* Info */}
        <div className="col-md-4">
          <div className="bc-card">
            <h6 className="text-muted mb-3" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Info</h6>
            <div className="mb-2"><span className="text-muted me-2">Account:</span><code>{client.account_number}</code></div>
            <div className="mb-2"><span className="text-muted me-2">Phone:</span>{client.phone || "—"}</div>
            <div className="mb-2"><span className="text-muted me-2">Email:</span>{client.email || "—"}</div>
            <div><span className="text-muted me-2">Status:</span>
              <span className={`badge ${client.is_active ? "badge-paid" : "badge-cancelled"}`}>
                {client.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        {/* Balance */}
        {balance && (
          <div className="col-md-8">
            <div className="bc-card">
              <h6 className="text-muted mb-3" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Balance</h6>
              <div className="row text-center">
                <div className="col-4">
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#dc2626" }}>{balance.debt.toFixed(2)}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Debt</div>
                </div>
                <div className="col-4">
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#059669" }}>{balance.paid_total.toFixed(2)}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Paid total</div>
                </div>
                <div className="col-4">
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: balance.balance > 0 ? "#dc2626" : "#059669" }}>
                    {balance.balance.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Balance</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Locations */}
      <div className="bc-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0" style={{ fontWeight: 600 }}>Locations</h6>
          <button className="btn btn-sm btn-outline-primary" onClick={() => setShowLocModal(true)}>
            <i className="bi bi-plus-lg me-1" /> Add
          </button>
        </div>
        {locations.length === 0 ? (
          <div className="text-muted text-center py-3">No locations</div>
        ) : (
          <div className="row g-2">
            {locations.map((l) => (
              <div key={l.id} className="col-md-4">
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem" }}>
                  <div className="fw-semibold">{l.name}</div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{l.address || "—"}</div>
                  {l.is_default && <span className="badge badge-paid mt-1">Default</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending calculations */}
      <div className="bc-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0" style={{ fontWeight: 600 }}>Pending calculations</h6>
          <button className="btn btn-sm btn-success" onClick={() => setShowPayModal(true)}>
            <i className="bi bi-cash me-1" /> Add payment
          </button>
        </div>
        <table className="table bc-table mb-0">
          <thead>
            <tr>
              <th>Period</th>
              <th>Quantity</th>
              <th>Amount</th>
              <th>Note</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted p-3">No pending calculations</td></tr>
            )}
            {pending.map((c) => (
              <tr key={c.id}>
                <td>{new Date(c.period_start).toLocaleDateString("en-US", { year: "numeric", month: "long" })}</td>
                <td>{c.quantity} {c.note}</td>
                <td><strong>{c.amount.toFixed(2)}</strong></td>
                <td>{c.note || "—"}</td>
                <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payments */}
      <div className="bc-card">
        <h6 className="mb-3" style={{ fontWeight: 600 }}>Payment history</h6>
        <table className="table bc-table mb-0">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={4} className="text-center text-muted p-3">No payments</td></tr>
            )}
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.paid_at).toLocaleDateString()}</td>
                <td><strong>{p.amount.toFixed(2)}</strong></td>
                <td>{p.method}</td>
                <td>{p.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Location modal */}
      <Modal title="Add Location" show={showLocModal} onClose={() => setShowLocModal(false)} onConfirm={saveLocation}>
        <div className="mb-3">
          <label className="form-label">Name *</label>
          <input className="form-control" placeholder="e.g. Apartment, Cottage" value={locForm.name}
            onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Address</label>
          <input className="form-control" value={locForm.address}
            onChange={(e) => setLocForm({ ...locForm, address: e.target.value })} />
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="isDefault" checked={locForm.is_default}
            onChange={(e) => setLocForm({ ...locForm, is_default: e.target.checked })} />
          <label className="form-check-label" htmlFor="isDefault">Set as default</label>
        </div>
      </Modal>

      {/* Payment modal */}
      <Modal title="Add Payment" show={showPayModal} onClose={() => setShowPayModal(false)} onConfirm={savePayment} confirmLabel="Add payment" confirmVariant="success">
        <div className="mb-3">
          <label className="form-label">Amount *</label>
          <input className="form-control" type="number" step="0.01" value={payForm.amount}
            onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Method</label>
          <select className="form-select" value={payForm.method}
            onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="online">Online</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Note</label>
          <input className="form-control" value={payForm.note}
            onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
        </div>
      </Modal>
    </>
  );
}
