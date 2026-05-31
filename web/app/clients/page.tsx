"use client";

import { useEffect, useState } from "react";
import { clientsApi } from "@/lib/api";
import type { Client } from "@/types";
import Modal from "@/app/_components/Modal";
import Alert from "@/app/_components/Alert";
import Link from "next/link";

const generateAccountNumber = () => {
  const prefix = "BC";
  const num = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${num}`;
};

const empty = (): Partial<Client> => ({
  full_name: "", phone: "", email: "", account_number: generateAccountNumber(),
});

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Client>>(empty());
  const [isEdit, setIsEdit] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = async () => {
    try {
      setClients(await clientsApi.list());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(empty()); setIsEdit(false); setShowModal(true); };
  const openEdit = (c: Client) => { setEditing(c); setIsEdit(true); setShowModal(true); };

  const save = async () => {
    try {
      if (isEdit && editing.id) {
        await clientsApi.update(editing.id, editing);
      } else {
        await clientsApi.create(editing as any);
      }
      setShowModal(false);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await clientsApi.delete(deleteId);
      setDeleteId(null);
      load();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <>
      <div className="bc-page-header">
        <h1>Clients</h1>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <i className="bi bi-plus-lg me-1" /> New Client
        </button>
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      <div className="bc-card p-0">
        {loading ? (
          <div className="p-4 text-center text-muted">Loading...</div>
        ) : (
          <table className="table bc-table mb-0">
            <thead>
              <tr>
                <th className="ps-3">Account</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted p-4">No clients yet</td></tr>
              )}
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="ps-3">
                    <code style={{ fontSize: "0.8rem" }}>{c.account_number}</code>
                  </td>
                  <td>
                    <Link href={`/clients/${c.id}`} className="fw-semibold text-decoration-none">
                      {c.full_name}
                    </Link>
                  </td>
                  <td>{c.phone || "—"}</td>
                  <td>{c.email || "—"}</td>
                  <td>
                    <span className={`badge ${c.is_active ? "badge-paid" : "badge-cancelled"}`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="text-end pe-3">
                    <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openEdit(c)}>
                      <i className="bi bi-pencil" />
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => setDeleteId(c.id)}>
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit modal */}
      <Modal
        title={isEdit ? "Edit Client" : "New Client"}
        show={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={save}
      >
        <div className="mb-3">
          <label className="form-label">Full name *</label>
          <input className="form-control" value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Account number *</label>
          {isEdit ? (
            <input className="form-control" value={editing.account_number ?? ""} readOnly disabled />
          ) : (
            <div className="input-group">
              <input className="form-control" value={editing.account_number ?? ""}
                onChange={(e) => setEditing({ ...editing, account_number: e.target.value })} />
              <button className="btn btn-outline-secondary" type="button"
                title="Generate new"
                onClick={() => setEditing({ ...editing, account_number: generateAccountNumber() })}>
                <i className="bi bi-arrow-clockwise" />
              </button>
            </div>
          )}
          {isEdit && <div className="form-text">Account number cannot be changed after creation.</div>}
        </div>
        <div className="mb-3">
          <label className="form-label">Phone</label>
          <input className="form-control" value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input className="form-control" type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
        </div>
        {isEdit && (
          <div className="form-check">
            <input className="form-check-input" type="checkbox" id="isActive" checked={editing.is_active ?? true}
              onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
            <label className="form-check-label" htmlFor="isActive">Active</label>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal
        title="Delete Client"
        show={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        confirmLabel="Delete"
        confirmVariant="danger"
      >
        Are you sure you want to delete this client? This action cannot be undone.
      </Modal>
    </>
  );
}
