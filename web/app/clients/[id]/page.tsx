"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { clientsApi, subscriptionsApi, servicesApi } from "@/lib/api";
import type { Client, Location, ClientBalance, CalculationRow, Payment, Subscription, Service } from "@/types";
import Modal from "@/app/_components/Modal";
import Alert from "@/app/_components/Alert";
import Link from "next/link";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);

  const [client, setClient] = useState<Client | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [balance, setBalance] = useState<ClientBalance | null>(null);
  const [pending, setPending] = useState<CalculationRow[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showLocModal, setShowLocModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locForm, setLocForm] = useState({ name: "", address: "", is_default: false });

  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: 0, method: "cash", note: "" });

  const [showSubModal, setShowSubModal] = useState(false);
  const [subLocationId, setSubLocationId] = useState(0);
  const [subForm, setSubForm] = useState({ service_id: 0, meter_number: "", connected_at: new Date().toISOString().split("T")[0], note: "" });
  const [disconnectId, setDisconnectId] = useState<number | null>(null);
  const [disconnectDate, setDisconnectDate] = useState(new Date().toISOString().split("T")[0]);
  const [deleteSubId, setDeleteSubId] = useState<number | null>(null);

  const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]));

  const openAddLocation = () => {
    setEditingLocation(null);
    setLocForm({ name: "", address: "", is_default: false });
    setShowLocModal(true);
  };

  const openEditLocation = (location: Location) => {
    setEditingLocation(location);
    setLocForm({
      name: location.name,
      address: location.address ?? "",
      is_default: location.is_default,
    });
    setShowLocModal(true);
  };

  const load = async () => {
    try {
      const [c, locs, bal, pend, pays, svcs] = await Promise.all([
        clientsApi.get(clientId),
        clientsApi.listLocations(clientId),
        clientsApi.balance(clientId),
        clientsApi.pending(clientId),
        clientsApi.payments(clientId),
        servicesApi.list(),
      ]);
      setClient(c); setLocations(locs); setBalance(bal); setPending(pend); setPayments(pays); setServices(svcs);

      // load subscriptions for all locations
      const allSubs = await Promise.all(locs.map((l) => subscriptionsApi.listByLocation(l.id)));
      setSubscriptions(allSubs.flat());
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { load(); }, [clientId]);

  const saveSubscription = async () => {
    try {
      await subscriptionsApi.create(subLocationId, subForm as any);
      setShowSubModal(false);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const disconnect = async () => {
    if (!disconnectId) return;
    try {
      await subscriptionsApi.disconnect(disconnectId, disconnectDate);
      setDisconnectId(null);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const deleteSub = async () => {
    if (!deleteSubId) return;
    try {
      await subscriptionsApi.delete(deleteSubId);
      setDeleteSubId(null);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const saveLocation = async () => {
    try {
      if (editingLocation) {
        await clientsApi.updateLocation(editingLocation.id, locForm);
      } else {
        await clientsApi.createLocation(clientId, locForm);
      }
      setShowLocModal(false);
      setEditingLocation(null);
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
                    {Math.abs(balance.balance).toFixed(2)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{balance.balance < 0 ? "Credit" : "Balance"}</div>
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
          <button className="btn btn-sm btn-outline-primary" onClick={openAddLocation}>
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
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <div className="fw-semibold">{l.name}</div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{l.address || "—"}</div>
                    </div>
                    <button className="btn btn-sm btn-outline-secondary" title="Edit"
                      onClick={() => openEditLocation(l)}>
                      <i className="bi bi-pencil" />
                    </button>
                  </div>
                  {l.is_default && <span className="badge badge-paid mt-1">Default</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscriptions */}
      <div className="bc-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0" style={{ fontWeight: 600 }}>Subscriptions</h6>
        </div>
        {locations.length === 0 ? (
          <div className="text-muted text-center py-2" style={{ fontSize: "0.875rem" }}>Add a location first</div>
        ) : subscriptions.length === 0 ? (
          <div className="text-muted text-center py-2" style={{ fontSize: "0.875rem" }}>No subscriptions yet</div>
        ) : (
          <table className="table bc-table mb-0">
            <thead>
              <tr>
                <th>Location</th>
                <th>Service</th>
                <th>Meter #</th>
                <th>Connected</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id}>
                  <td>{locations.find((l) => l.id === s.location_id)?.name ?? s.location_id}</td>
                  <td>{serviceMap[s.service_id]?.name ?? `#${s.service_id}`}</td>
                  <td>{s.meter_number ? <code>{s.meter_number}</code> : "—"}</td>
                  <td>{new Date(s.connected_at).toLocaleDateString()}</td>
                  <td>
                    {s.disconnected_at
                      ? <span className="badge badge-cancelled">Disconnected</span>
                      : <span className="badge badge-paid">Active</span>}
                  </td>
                  <td className="text-end">
                    {!s.disconnected_at && (
                      <button className="btn btn-sm btn-outline-warning me-1" title="Disconnect"
                        onClick={() => { setDisconnectId(s.id); setDisconnectDate(new Date().toISOString().split("T")[0]); }}>
                        <i className="bi bi-slash-circle" />
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-danger" title="Delete"
                      onClick={() => setDeleteSubId(s.id)}>
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {locations.length > 0 && (
          <div className="mt-3">
            <label className="form-label mb-1" style={{ fontSize: "0.8rem", color: "#64748b" }}>Add subscription to location:</label>
            <div className="d-flex gap-2 flex-wrap">
              {locations.map((l) => (
                <button key={l.id} className="btn btn-sm btn-outline-primary"
                  onClick={() => { setSubLocationId(l.id); setSubForm({ service_id: 0, meter_number: "", connected_at: new Date().toISOString().split("T")[0], note: "" }); setShowSubModal(true); }}>
                  <i className="bi bi-plus-lg me-1" />{l.name}
                </button>
              ))}
            </div>
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
              <th>Service</th>
              <th>Location</th>
              <th>Period</th>
              <th>Prev</th>
              <th>Curr</th>
              <th>Amount</th>
              <th>Note</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 && (
              <tr><td colSpan={8} className="text-center text-muted p-3">No pending calculations</td></tr>
            )}
            {pending.map((c) => (
              <tr key={c.id}>
                <td className="fw-semibold">
                  {c.service_name}
                  <span className="text-muted ms-1" style={{ fontSize: "0.75rem" }}>({c.unit})</span>
                </td>
                <td style={{ fontSize: "0.85rem", color: "#64748b" }}>{c.location_name}</td>
                <td>
                  <Link href={`/calculations?period_id=${c.period_id}&client_id=${clientId}`}
                    className="text-decoration-none" style={{ fontSize: "0.85rem" }}>
                    #{c.period_id}
                  </Link>
                </td>
                <td>{c.reading_prev ?? "—"}</td>
                <td>{c.reading_curr != null ? c.reading_curr : c.has_meter ? <span className="text-warning">—</span> : "—"}</td>
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

      {/* Subscription create modal */}
      <Modal title="New Subscription" show={showSubModal} onClose={() => setShowSubModal(false)} onConfirm={saveSubscription}>
        <div className="mb-3">
          <label className="form-label">Service *</label>
          <select className="form-select" value={subForm.service_id || ""}
            onChange={(e) => setSubForm({ ...subForm, service_id: Number(e.target.value) })}>
            <option value="">— select service —</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Meter number</label>
          <input className="form-control" placeholder="e.g. 5248511" value={subForm.meter_number}
            onChange={(e) => setSubForm({ ...subForm, meter_number: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Connected at *</label>
          <input className="form-control" type="date" value={subForm.connected_at}
            onChange={(e) => setSubForm({ ...subForm, connected_at: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Note</label>
          <input className="form-control" value={subForm.note}
            onChange={(e) => setSubForm({ ...subForm, note: e.target.value })} />
        </div>
      </Modal>

      {/* Disconnect modal */}
      <Modal title="Disconnect subscription" show={disconnectId !== null}
        onClose={() => setDisconnectId(null)} onConfirm={disconnect}
        confirmLabel="Disconnect" confirmVariant="warning">
        <div className="mb-3">
          <label className="form-label">Disconnection date</label>
          <input className="form-control" type="date" value={disconnectDate}
            onChange={(e) => setDisconnectDate(e.target.value)} />
        </div>
      </Modal>

      {/* Delete subscription modal */}
      <Modal title="Delete subscription" show={deleteSubId !== null}
        onClose={() => setDeleteSubId(null)} onConfirm={deleteSub}
        confirmLabel="Delete" confirmVariant="danger">
        Are you sure you want to delete this subscription?
      </Modal>

      {/* Location modal */}
      <Modal
        title={editingLocation ? "Edit Location" : "Add Location"}
        show={showLocModal}
        onClose={() => { setShowLocModal(false); setEditingLocation(null); }}
        onConfirm={saveLocation}
        confirmLabel={editingLocation ? "Save" : "Create"}
      >
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
