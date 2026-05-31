"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clientsApi } from "@/lib/api";
import type { Location } from "@/types";
import Alert from "@/app/_components/Alert";
import Modal from "@/app/_components/Modal";

const emptyForm = { name: "", address: "", is_default: false };

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = async () => {
    try {
      setLocations(await clientsApi.listAllLocations());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (location: Location) => {
    setEditing(location);
    setForm({
      name: location.name,
      address: location.address ?? "",
      is_default: location.is_default,
    });
  };

  const save = async () => {
    if (!editing) return;
    try {
      await clientsApi.updateLocation(editing.id, form);
      setEditing(null);
      setForm(emptyForm);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    try {
      await clientsApi.deleteLocation(deleteId);
      setDeleteId(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="bc-page-header">
        <h1>Locations</h1>
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      <div className="bc-card p-0">
        {loading ? (
          <div className="p-4 text-center text-muted">Loading...</div>
        ) : (
          <table className="table bc-table mb-0">
            <thead>
              <tr>
                <th className="ps-3">Location</th>
                <th>Client</th>
                <th>Address</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted p-4">No locations</td></tr>
              )}
              {locations.map((l) => (
                <tr key={l.id}>
                  <td className="ps-3 fw-semibold">{l.name}</td>
                  <td>
                    <Link href={`/clients/${l.client_id}`} className="text-decoration-none">
                      {l.client_name ?? `Client #${l.client_id}`}
                    </Link>
                    {l.account_number && <div><code style={{ fontSize: "0.75rem" }}>{l.account_number}</code></div>}
                  </td>
                  <td>{l.address || "—"}</td>
                  <td>{l.is_default ? <span className="badge badge-paid">Default</span> : "—"}</td>
                  <td className="text-end pe-3">
                    <button className="btn btn-sm btn-outline-secondary me-1" title="Edit"
                      onClick={() => openEdit(l)}>
                      <i className="bi bi-pencil" />
                    </button>
                    <button className="btn btn-sm btn-outline-danger" title="Delete"
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

      <Modal title="Edit Location" show={editing !== null} onClose={() => setEditing(null)} onConfirm={save}>
        <div className="mb-3">
          <label className="form-label">Name *</label>
          <input className="form-control" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Address</label>
          <input className="form-control" value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="isDefaultLocation" checked={form.is_default}
            onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
          <label className="form-check-label" htmlFor="isDefaultLocation">Set as default</label>
        </div>
      </Modal>

      <Modal title="Delete Location" show={deleteId !== null}
        onClose={() => setDeleteId(null)} onConfirm={remove}
        confirmLabel="Delete" confirmVariant="danger">
        Delete this location only if it has no subscriptions.
      </Modal>
    </>
  );
}
