"use client";

import { useEffect, useState } from "react";
import { usersApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { User } from "@/types";
import Modal from "@/app/_components/Modal";
import Alert from "@/app/_components/Alert";

export default function UsersPage() {
  const [users, setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const me = getUser();

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ username: "", email: "", password: "", role: "operator" });

  // edit modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ username: "", email: "", role: "operator" });

  // password modal
  const [pwdId, setPwdId]   = useState<number | null>(null);
  const [pwdVal, setPwdVal] = useState("");

  // delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = async () => {
    try { setUsers(await usersApi.list()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await usersApi.create(createForm);
      setShowCreate(false);
      setCreateForm({ username: "", email: "", password: "", role: "operator" });
      load();
    } catch (e: any) { setError(e.message); }
  };

  const update = async () => {
    if (!editUser) return;
    try {
      await usersApi.update(editUser.id, editForm as any);
      setEditUser(null);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const changePassword = async () => {
    if (!pwdId) return;
    try {
      await usersApi.changePassword(pwdId, pwdVal);
      setPwdId(null);
      setPwdVal("");
    } catch (e: any) { setError(e.message); }
  };

  const toggleBlock = async (u: User) => {
    try {
      if (u.is_active) await usersApi.block(u.id);
      else await usersApi.unblock(u.id);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await usersApi.delete(deleteId);
      setDeleteId(null);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const roleColor = { admin: "#7c3aed", operator: "#0891b2" };

  return (
    <>
      <div className="bc-page-header">
        <h1>Users</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <i className="bi bi-plus-lg me-1" /> New User
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
                <th className="ps-3">Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={!u.is_active ? { opacity: 0.6 } : {}}>
                  <td className="ps-3 fw-semibold">
                    {u.username}
                    {u.id === me?.id && (
                      <span className="badge ms-2" style={{ background: "#e0f2fe", color: "#0369a1", fontSize: "0.7rem" }}>you</span>
                    )}
                  </td>
                  <td>{u.email || "—"}</td>
                  <td>
                    <span className="badge" style={{ background: roleColor[u.role] + "22", color: roleColor[u.role] }}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {u.is_active
                      ? <span className="badge badge-paid">Active</span>
                      : <span className="badge badge-cancelled">Blocked</span>}
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="text-end pe-3">
                    <button className="btn btn-sm btn-outline-secondary me-1" title="Edit"
                      onClick={() => { setEditUser(u); setEditForm({ username: u.username, email: u.email ?? "", role: u.role }); }}>
                      <i className="bi bi-pencil" />
                    </button>
                    <button className="btn btn-sm btn-outline-secondary me-1" title="Change password"
                      onClick={() => { setPwdId(u.id); setPwdVal(""); }}>
                      <i className="bi bi-key" />
                    </button>
                    <button
                      className={`btn btn-sm me-1 ${u.is_active ? "btn-outline-warning" : "btn-outline-success"}`}
                      title={u.is_active ? "Block" : "Unblock"}
                      disabled={u.id === me?.id}
                      onClick={() => toggleBlock(u)}>
                      <i className={`bi bi-${u.is_active ? "slash-circle" : "check-circle"}`} />
                    </button>
                    <button className="btn btn-sm btn-outline-danger" title="Delete"
                      disabled={u.id === me?.id}
                      onClick={() => setDeleteId(u.id)}>
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
      <Modal title="New User" show={showCreate} onClose={() => setShowCreate(false)} onConfirm={create}>
        <div className="mb-3">
          <label className="form-label">Username *</label>
          <input className="form-control" value={createForm.username}
            onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input className="form-control" type="email" value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Password *</label>
          <input className="form-control" type="password" value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Role</label>
          <select className="form-select" value={createForm.role}
            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal title="Edit User" show={editUser !== null} onClose={() => setEditUser(null)} onConfirm={update}>
        <div className="mb-3">
          <label className="form-label">Username *</label>
          <input className="form-control" value={editForm.username}
            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input className="form-control" type="email" value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Role</label>
          <select className="form-select" value={editForm.role}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </Modal>

      {/* Password modal */}
      <Modal title="Change Password" show={pwdId !== null} onClose={() => setPwdId(null)} onConfirm={changePassword} confirmLabel="Change">
        <div className="mb-3">
          <label className="form-label">New password *</label>
          <input className="form-control" type="password" value={pwdVal}
            onChange={(e) => setPwdVal(e.target.value)} autoFocus />
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal title="Delete User" show={deleteId !== null} onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete} confirmLabel="Delete" confirmVariant="danger">
        <p>Delete this user?</p>
        <p className="text-muted mb-0" style={{ fontSize: "0.875rem" }}>
          Only possible if the user has no action history in the system.
        </p>
      </Modal>
    </>
  );
}
