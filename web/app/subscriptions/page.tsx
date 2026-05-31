"use client";

import { useEffect, useState } from "react";
import { subscriptionsApi, clientsApi, servicesApi } from "@/lib/api";
import type { Subscription, Client, Service, Location } from "@/types";
import Modal from "@/app/_components/Modal";
import Alert from "@/app/_components/Alert";
import Link from "next/link";

export default function SubscriptionsPage() {
  const [subs, setSubs]         = useState<Subscription[]>([]);
  const [clients, setClients]   = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  // filters
  const [filterClient, setFilterClient] = useState<number | "">("");

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ location_id: 0, service_id: 0, meter_number: "", connected_at: today(), note: "" });

  // edit modal
  const [editSub, setEditSub] = useState<Subscription | null>(null);

  // disconnect modal
  const [disconnectId, setDisconnectId] = useState<number | null>(null);
  const [disconnectDate, setDisconnectDate] = useState(today());

  // delete modal
  const [deleteId, setDeleteId] = useState<number | null>(null);

  function today() {
    return new Date().toISOString().split("T")[0];
  }

  const load = async () => {
    try {
      const [s, c, sv] = await Promise.all([
        subscriptionsApi.listAll(),
        clientsApi.list(),
        servicesApi.list(),
      ]);
      setSubs(s); setClients(c); setServices(sv);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  // load locations when client filter changes
  useEffect(() => {
    if (!filterClient) { setLocations([]); return; }
    clientsApi.listLocations(Number(filterClient)).then(setLocations).catch((e) => setError(e.message));
  }, [filterClient]);

  useEffect(() => { load(); }, []);

  const clientMap   = Object.fromEntries(clients.map((c) => [c.id, c]));
  const serviceMap  = Object.fromEntries(services.map((s) => [s.id, s]));

  const filtered = filterClient
    ? subs.filter((s) => {
        // we don't have client_id directly on subscription — filter client-side via location
        return locations.some((l) => l.id === s.location_id);
      })
    : subs;

  const create = async () => {
    try {
      await subscriptionsApi.create(form.location_id, form);
      setShowCreate(false);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const update = async () => {
    if (!editSub) return;
    try {
      await subscriptionsApi.update(editSub.id, editSub);
      setEditSub(null);
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

  const remove = async () => {
    if (!deleteId) return;
    try {
      await subscriptionsApi.delete(deleteId);
      setDeleteId(null);
      load();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <>
      <div className="bc-page-header">
        <h1>Subscriptions</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm({ location_id: 0, service_id: 0, meter_number: "", connected_at: today(), note: "" }); setShowCreate(true); }}>
          <i className="bi bi-plus-lg me-1" /> New Subscription
        </button>
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      {/* Filter */}
      <div className="bc-card">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Filter by client</label>
            <select className="form-select" value={filterClient}
              onChange={(e) => setFilterClient(e.target.value ? Number(e.target.value) : "")}>
              <option value="">— all clients —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name} ({c.account_number})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bc-card p-0">
        {loading ? (
          <div className="p-4 text-center text-muted">Loading...</div>
        ) : (
          <table className="table bc-table mb-0">
            <thead>
              <tr>
                <th className="ps-3">Service</th>
                <th>Location</th>
                <th>Meter #</th>
                <th>Connected</th>
                <th>Status</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted p-4">No subscriptions</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="ps-3 fw-semibold">{serviceMap[s.service_id]?.name ?? `#${s.service_id}`}</td>
                  <td>{s.location_id}</td>
                  <td>{s.meter_number ? <code>{s.meter_number}</code> : "—"}</td>
                  <td>{new Date(s.connected_at).toLocaleDateString()}</td>
                  <td>
                    {s.disconnected_at
                      ? <span className="badge badge-cancelled">Disconnected {new Date(s.disconnected_at).toLocaleDateString()}</span>
                      : <span className="badge badge-paid">Active</span>}
                  </td>
                  <td>{s.note || "—"}</td>
                  <td className="text-end pe-3">
                    <button className="btn btn-sm btn-outline-secondary me-1" title="Edit"
                      onClick={() => setEditSub({ ...s })}>
                      <i className="bi bi-pencil" />
                    </button>
                    {!s.disconnected_at && (
                      <button className="btn btn-sm btn-outline-warning me-1" title="Disconnect"
                        onClick={() => { setDisconnectId(s.id); setDisconnectDate(today()); }}>
                        <i className="bi bi-slash-circle" />
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-danger" title="Delete"
                      onClick={() => setDeleteId(s.id)}>
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      <Modal title="New Subscription" show={showCreate} onClose={() => setShowCreate(false)} onConfirm={create}>
        <div className="mb-3">
          <label className="form-label">Client</label>
          <select className="form-select" value={filterClient || ""}
            onChange={(e) => {
              const cid = Number(e.target.value);
              setFilterClient(cid);
              setForm({ ...form, location_id: 0 });
            }}>
            <option value="">— select client —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Location *</label>
          <select className="form-select" value={form.location_id || ""}
            onChange={(e) => setForm({ ...form, location_id: Number(e.target.value) })}>
            <option value="">— select location —</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name} {l.address ? `(${l.address})` : ""}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Service *</label>
          <select className="form-select" value={form.service_id || ""}
            onChange={(e) => setForm({ ...form, service_id: Number(e.target.value) })}>
            <option value="">— select service —</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Meter number</label>
          <input className="form-control" placeholder="e.g. 5248511" value={form.meter_number}
            onChange={(e) => setForm({ ...form, meter_number: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Connected at *</label>
          <input className="form-control" type="date" value={form.connected_at}
            onChange={(e) => setForm({ ...form, connected_at: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Note</label>
          <input className="form-control" value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal title="Edit Subscription" show={editSub !== null} onClose={() => setEditSub(null)} onConfirm={update}>
        <div className="mb-3">
          <label className="form-label">Meter number</label>
          <input className="form-control" value={editSub?.meter_number ?? ""}
            onChange={(e) => setEditSub((prev) => prev ? { ...prev, meter_number: e.target.value } : prev)} />
        </div>
        <div className="mb-3">
          <label className="form-label">Note</label>
          <input className="form-control" value={editSub?.note ?? ""}
            onChange={(e) => setEditSub((prev) => prev ? { ...prev, note: e.target.value } : prev)} />
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

      {/* Delete modal */}
      <Modal title="Delete subscription" show={deleteId !== null}
        onClose={() => setDeleteId(null)} onConfirm={remove}
        confirmLabel="Delete" confirmVariant="danger">
        Are you sure? All calculations for this subscription will lose their reference.
      </Modal>
    </>
  );
}
