"use client";

import { useEffect, useState, useCallback } from "react";
import { clientsApi } from "@/lib/api";
import type { Client, ClientPage } from "@/types";
import Modal from "@/app/_components/Modal";
import Alert from "@/app/_components/Alert";
import Link from "next/link";

const generateAccountNumber = () => `BC-${Math.floor(10000000 + Math.random() * 90000000)}`;
const empty = (): Partial<Client> => ({ full_name: "", phone: "", email: "", account_number: generateAccountNumber() });

const LIMIT = 20;

export default function ClientsPage() {
  const [page, setPage]       = useState<ClientPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // filter inputs (not yet applied)
  const [searchInput, setSearchInput] = useState("");
  const [statusInput, setStatusInput] = useState("");

  // applied filter state (triggers load)
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);

  // modals
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Partial<Client>>(empty());
  const [isEdit, setIsEdit]       = useState(false);
  const [deleteId, setDeleteId]   = useState<number | null>(null);

  const applySearch = () => {
    setSearch(searchInput);
    setStatus(statusInput);
    setOffset(0);
  };

  const clearSearch = () => {
    setSearchInput("");
    setStatusInput("");
    setSearch("");
    setStatus("");
    setOffset(0);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") applySearch();
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await clientsApi.list({
        search: search || undefined,
        status: status || undefined,
        limit: LIMIT,
        offset,
      });
      setPage(result);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [search, status, offset]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(empty()); setIsEdit(false); setShowModal(true); };
  const openEdit   = (c: Client) => { setEditing(c); setIsEdit(true); setShowModal(true); };

  const save = async () => {
    try {
      if (isEdit && editing.id) await clientsApi.update(editing.id, editing);
      else await clientsApi.create(editing as any);
      setShowModal(false);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try { await clientsApi.delete(deleteId); setDeleteId(null); load(); }
    catch (e: any) { setError(e.message); }
  };

  const clients  = page?.clients ?? [];
  const total    = page?.total ?? 0;
  const showing  = offset + clients.length;
  const hasMore  = showing < total;
  const hasPrev  = offset > 0;
  const pages    = Math.ceil(total / LIMIT);
  const curPage  = Math.floor(offset / LIMIT) + 1;

  return (
    <>
      <div className="bc-page-header">
        <h1>Clients</h1>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <i className="bi bi-plus-lg me-1" /> New Client
        </button>
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      {/* Filters */}
      <div className="bc-card">
        <div className="row g-2 align-items-end">
          <div className="col-md-5">
            <label className="form-label">Search by name or account number</label>
            <input className="form-control" placeholder="e.g. Bob or BC-12345678"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKey} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Status</label>
            <select className="form-select" value={statusInput}
              onChange={(e) => setStatusInput(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="col-md-auto d-flex gap-2">
            <button className="btn btn-primary" onClick={applySearch}>
              <i className="bi bi-search me-1" />Search
            </button>
            {(search || status) && (
              <button className="btn btn-outline-secondary" onClick={clearSearch}>
                <i className="bi bi-x me-1" />Clear
              </button>
            )}
          </div>
          <div className="col-12 mt-1">
            {page && (
              <span className="text-muted" style={{ fontSize: "0.82rem" }}>
                {total === 0
                  ? "No clients found"
                  : total > LIMIT
                    ? `Showing ${offset + 1}–${showing} of ${total} clients (limit ${LIMIT})`
                    : `${total} client${total !== 1 ? "s" : ""}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bc-card p-0">
        {loading ? (
          <div className="p-4 text-center text-muted">Loading...</div>
        ) : (
          <>
            <table className="table bc-table mb-0">
              <thead>
                <tr>
                  <th className="ps-3">Account</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted p-4">No clients found</td></tr>
                )}
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td className="ps-3"><code style={{ fontSize: "0.8rem" }}>{c.account_number}</code></td>
                    <td>
                      <Link href={`/clients/detail?id=${c.id}`} className="fw-semibold text-decoration-none">
                        {c.full_name}
                      </Link>
                    </td>
                    <td>{c.phone || "—"}</td>
                    <td>
                      <span className={`badge ${c.is_active ? "badge-paid" : "badge-cancelled"}`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-end pe-3">
                      {/* Quick access */}
                      <Link href={`/locations?client_id=${c.id}`}
                        className="btn btn-sm btn-outline-secondary me-1" title="Locations">
                        <i className="bi bi-geo-alt" />
                      </Link>
                      <Link href={`/subscriptions?client_id=${c.id}`}
                        className="btn btn-sm btn-outline-secondary me-1" title="Subscriptions">
                        <i className="bi bi-link-45deg" />
                      </Link>
                      <Link href={`/calculations?client_id=${c.id}`}
                        className="btn btn-sm btn-outline-secondary me-1" title="Calculations">
                        <i className="bi bi-calculator" />
                      </Link>
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

            {/* Pagination */}
            {pages > 1 && (
              <div className="d-flex align-items-center justify-content-between px-3 py-2"
                style={{ borderTop: "1px solid #e2e8f0" }}>
                <button className="btn btn-sm btn-outline-secondary"
                  disabled={!hasPrev} onClick={() => setOffset(offset - LIMIT)}>
                  <i className="bi bi-chevron-left me-1" />Prev
                </button>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  Page {curPage} of {pages}
                </span>
                <button className="btn btn-sm btn-outline-secondary"
                  disabled={!hasMore} onClick={() => setOffset(offset + LIMIT)}>
                  Next<i className="bi bi-chevron-right ms-1" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create / Edit modal */}
      <Modal title={isEdit ? "Edit Client" : "New Client"}
        show={showModal} onClose={() => setShowModal(false)} onConfirm={save}>
        <div className="mb-3">
          <label className="form-label">Full name *</label>
          <input className="form-control" value={editing.full_name ?? ""}
            onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Account number *</label>
          {isEdit ? (
            <input className="form-control" value={editing.account_number ?? ""} readOnly disabled />
          ) : (
            <div className="input-group">
              <input className="form-control" value={editing.account_number ?? ""}
                onChange={(e) => setEditing({ ...editing, account_number: e.target.value })} />
              <button className="btn btn-outline-secondary" type="button" title="Generate new"
                onClick={() => setEditing({ ...editing, account_number: generateAccountNumber() })}>
                <i className="bi bi-arrow-clockwise" />
              </button>
            </div>
          )}
          {isEdit && <div className="form-text">Account number cannot be changed after creation.</div>}
        </div>
        <div className="mb-3">
          <label className="form-label">Phone</label>
          <input className="form-control" value={editing.phone ?? ""}
            onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input className="form-control" type="email" value={editing.email ?? ""}
            onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
        </div>
        {isEdit && (
          <div className="form-check">
            <input className="form-check-input" type="checkbox" id="isActive"
              checked={editing.is_active ?? true}
              onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
            <label className="form-check-label" htmlFor="isActive">Active</label>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal title="Delete Client" show={deleteId !== null}
        onClose={() => setDeleteId(null)} onConfirm={confirmDelete}
        confirmLabel="Delete" confirmVariant="danger">
        Are you sure you want to delete this client? This action cannot be undone.
      </Modal>
    </>
  );
}
