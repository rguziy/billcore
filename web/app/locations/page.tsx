"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { clientsApi } from "@/lib/api";
import type { Location, Client } from "@/types";
import Modal from "@/app/_components/Modal";
import Alert from "@/app/_components/Alert";
import Link from "next/link";

function LocationsContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [clients, setClients]     = useState<Client[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const clientId = searchParams.get("client_id") ? Number(searchParams.get("client_id")) : "";
  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", address: "", is_default: false });

  // edit modal
  const [editLoc, setEditLoc] = useState<Location | null>(null);
  const [editForm, setEditForm] = useState({ name: "", address: "", is_default: false });

  // delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // load clients for filter dropdown
  useEffect(() => {
    clientsApi.list({ limit: 1000 })
      .then((p) => setClients(p.clients))
      .catch((e) => setError(e.message));
  }, []);

  // load locations when client changes
  useEffect(() => {
    if (!clientId) { setLocations([]); return; }
    setLoading(true);
    clientsApi.listLocations(Number(clientId))
      .then(setLocations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  const setClient = (val: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (val) p.set("client_id", val); else p.delete("client_id");
    router.push(`/locations?${p.toString()}`);
  };

  const reload = () => {
    if (!clientId) return;
    clientsApi.listLocations(Number(clientId)).then(setLocations).catch((e) => setError(e.message));
  };

  const create = async () => {
    if (!clientId) return;
    try {
      await clientsApi.createLocation(Number(clientId), createForm);
      setShowCreate(false);
      setCreateForm({ name: "", address: "", is_default: false });
      reload();
    } catch (e: any) { setError(e.message); }
  };

  const update = async () => {
    if (!editLoc) return;
    try {
      await clientsApi.updateLocation(editLoc.id, editForm);
      setEditLoc(null);
      reload();
    } catch (e: any) { setError(e.message); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await clientsApi.deleteLocation(deleteId);
      setDeleteId(null);
      reload();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <>
      <div className="bc-page-header">
        <h1>Locations</h1>
        <button className="btn btn-primary btn-sm"
          disabled={!clientId}
          title={!clientId ? "Select a client first" : ""}
          onClick={() => { setCreateForm({ name: "", address: "", is_default: false }); setShowCreate(true); }}>
          <i className="bi bi-plus-lg me-1" /> Add Location
        </button>
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      {/* Client filter */}
      <div className="bc-card">
        <div className="row g-2 align-items-end">
          <div className="col-md-5">
            <label className="form-label">Client *</label>
            <select className="form-select" value={clientId}
              onChange={(e) => setClient(e.target.value)}>
              <option value="">— select client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.account_number})
                </option>
              ))}
            </select>
          </div>
          {selectedClient && (
            <div className="col-md-auto d-flex gap-2 pb-1">
              <Link href={`/clients/detail?id=${selectedClient.id}`} className="btn btn-sm btn-outline-secondary">
                <i className="bi bi-person me-1" />Client profile
              </Link>
              <Link href={`/subscriptions?client_id=${selectedClient.id}`} className="btn btn-sm btn-outline-secondary">
                <i className="bi bi-link-45deg me-1" />Subscriptions
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Locations table */}
      {!clientId ? (
        <div className="bc-card text-center text-muted py-4">
          <i className="bi bi-geo-alt" style={{ fontSize: "2rem", opacity: 0.3 }} />
          <div className="mt-2">Select a client to view their locations</div>
        </div>
      ) : (
        <div className="bc-card p-0">
          {loading ? (
            <div className="p-4 text-center text-muted">Loading...</div>
          ) : (
            <table className="table bc-table mb-0">
              <thead>
                <tr>
                  <th className="ps-3">Name</th>
                  <th>Address</th>
                  <th>Default</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {locations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted p-4">
                      No locations yet.
                      <button className="btn btn-sm btn-link p-0 ms-1"
                        onClick={() => setShowCreate(true)}>Add one</button>
                    </td>
                  </tr>
                )}
                {locations.map((l) => (
                  <tr key={l.id}>
                    <td className="ps-3 fw-semibold">{l.name}</td>
                    <td>{l.address || "—"}</td>
                    <td>
                      {l.is_default
                        ? <span className="badge badge-paid">Default</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>{new Date(l.created_at).toLocaleDateString()}</td>
                    <td className="text-end pe-3">
                      <Link href={`/subscriptions?client_id=${clientId}`}
                        className="btn btn-sm btn-outline-secondary me-1" title="Subscriptions">
                        <i className="bi bi-link-45deg" />
                      </Link>
                      <button className="btn btn-sm btn-outline-secondary me-1"
                        onClick={() => { setEditLoc(l); setEditForm({ name: l.name, address: l.address ?? "", is_default: l.is_default }); }}>
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="btn btn-sm btn-outline-danger"
                        onClick={() => setDeleteId(l.id)}>
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create modal */}
      <Modal title={`Add Location${selectedClient ? ` — ${selectedClient.full_name}` : ""}`}
        show={showCreate} onClose={() => setShowCreate(false)} onConfirm={create}>
        <div className="mb-3">
          <label className="form-label">Name *</label>
          <input className="form-control" placeholder="e.g. Apartment, Cottage, Office"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Address</label>
          <input className="form-control" value={createForm.address}
            onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} />
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="createDefault"
            checked={createForm.is_default}
            onChange={(e) => setCreateForm({ ...createForm, is_default: e.target.checked })} />
          <label className="form-check-label" htmlFor="createDefault">Set as default</label>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal title="Edit Location" show={editLoc !== null}
        onClose={() => setEditLoc(null)} onConfirm={update}>
        <div className="mb-3">
          <label className="form-label">Name *</label>
          <input className="form-control" value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Address</label>
          <input className="form-control" value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="editDefault"
            checked={editForm.is_default}
            onChange={(e) => setEditForm({ ...editForm, is_default: e.target.checked })} />
          <label className="form-check-label" htmlFor="editDefault">Set as default</label>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal title="Delete Location" show={deleteId !== null}
        onClose={() => setDeleteId(null)} onConfirm={confirmDelete}
        confirmLabel="Delete" confirmVariant="danger">
        Delete this location? All associated subscriptions will be affected.
      </Modal>
    </>
  );
}

export default function LocationsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-muted">Loading...</div>}>
      <LocationsContent />
    </Suspense>
  );
}
