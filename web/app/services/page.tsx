"use client";

import React, { useEffect, useState } from "react";
import { servicesApi } from "@/lib/api";
import type { Service, Tariff } from "@/types";
import Modal from "@/app/_components/Modal";
import Alert from "@/app/_components/Alert";

const emptyService = (): Partial<Service> => ({ name: "", unit: "", has_meter: false });

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [tariffs, setTariffs] = useState<Record<number, Tariff[]>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showSvcModal, setShowSvcModal] = useState(false);
  const [editingSvc, setEditingSvc] = useState<Partial<Service>>(emptyService());
  const [isEditSvc, setIsEditSvc] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [showTariffModal, setShowTariffModal] = useState(false);
  const [tariffServiceId, setTariffServiceId] = useState<number | null>(null);
  const [tariffForm, setTariffForm] = useState({ price_per_unit: 0, valid_from: "", valid_to: "", note: "" });

  const load = async () => {
    try { setServices(await servicesApi.list()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = async (svc: Service) => {
    if (expanded === svc.id) { setExpanded(null); return; }
    setExpanded(svc.id);
    if (!tariffs[svc.id]) {
      try {
        const t = await servicesApi.listTariffs(svc.id);
        setTariffs((prev) => ({ ...prev, [svc.id]: t }));
      } catch (e: any) { setError(e.message); }
    }
  };

  const openCreate = () => { setEditingSvc(emptyService()); setIsEditSvc(false); setShowSvcModal(true); };
  const openEdit = (s: Service) => { setEditingSvc(s); setIsEditSvc(true); setShowSvcModal(true); };

  const saveSvc = async () => {
    try {
      if (isEditSvc && editingSvc.id) await servicesApi.update(editingSvc.id, editingSvc);
      else await servicesApi.create(editingSvc as any);
      setShowSvcModal(false);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try { await servicesApi.delete(deleteId); setDeleteId(null); load(); }
    catch (e: any) { setError(e.message); }
  };

  const openTariff = (serviceId: number) => {
    setTariffServiceId(serviceId);
    setTariffForm({ price_per_unit: 0, valid_from: "", valid_to: "", note: "" });
    setShowTariffModal(true);
  };

  const saveTariff = async () => {
    if (!tariffServiceId) return;
    try {
      await servicesApi.createTariff(tariffServiceId, {
        ...tariffForm,
        valid_to: tariffForm.valid_to || undefined,
      } as any);
      const t = await servicesApi.listTariffs(tariffServiceId);
      setTariffs((prev) => ({ ...prev, [tariffServiceId]: t }));
      setShowTariffModal(false);
    } catch (e: any) { setError(e.message); }
  };

  return (
    <>
      <div className="bc-page-header">
        <h1>Services</h1>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <i className="bi bi-plus-lg me-1" /> New Service
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
                <th className="ps-3">Name</th>
                <th>Unit</th>
                <th>Meter</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 && (
                <tr><td colSpan={4} className="text-center text-muted p-4">No services yet</td></tr>
              )}
              {services.map((s) => (
                <React.Fragment key={s.id}>
                  <tr>
                    <td className="ps-3 fw-semibold">{s.name}</td>
                    <td><code>{s.unit}</code></td>
                    <td>
                      {s.has_meter
                        ? <span className="badge badge-paid">Yes</span>
                        : <span className="badge" style={{ background: "#f1f5f9", color: "#64748b" }}>No</span>}
                    </td>
                    <td className="text-end pe-3">
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => toggleExpand(s)}>
                        <i className={`bi bi-chevron-${expanded === s.id ? "up" : "down"}`} />
                      </button>
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openEdit(s)}>
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => setDeleteId(s.id)}>
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                  {expanded === s.id && (
                    <tr key={`tariffs-${s.id}`} style={{ background: "#f8fafc" }}>
                      <td colSpan={4} className="px-4 py-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <strong style={{ fontSize: "0.85rem" }}>Tariffs</strong>
                          <button className="btn btn-xs btn-outline-primary btn-sm" onClick={() => openTariff(s.id)}>
                            <i className="bi bi-plus-lg me-1" /> Add tariff
                          </button>
                        </div>
                        {!tariffs[s.id]?.length ? (
                          <div className="text-muted" style={{ fontSize: "0.85rem" }}>No tariffs</div>
                        ) : (
                          <table className="table table-sm mb-0">
                            <thead>
                              <tr>
                                <th>Price / unit</th>
                                <th>Valid from</th>
                                <th>Valid to</th>
                                <th>Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tariffs[s.id].map((t) => (
                                <tr key={t.id}>
                                  <td><strong>{t.price_per_unit}</strong></td>
                                  <td>{new Date(t.valid_from).toLocaleDateString()}</td>
                                  <td>{t.valid_to ? new Date(t.valid_to).toLocaleDateString() : <span className="badge badge-paid">Active</span>}</td>
                                  <td>{t.note || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Service modal */}
      <Modal title={isEditSvc ? "Edit Service" : "New Service"} show={showSvcModal} onClose={() => setShowSvcModal(false)} onConfirm={saveSvc}>
        <div className="mb-3">
          <label className="form-label">Name *</label>
          <input className="form-control" value={editingSvc.name ?? ""} onChange={(e) => setEditingSvc({ ...editingSvc, name: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Unit *</label>
          <input className="form-control" placeholder="m³, kWh, month" value={editingSvc.unit ?? ""} onChange={(e) => setEditingSvc({ ...editingSvc, unit: e.target.value })} />
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="hasMeter" checked={editingSvc.has_meter ?? false}
            onChange={(e) => setEditingSvc({ ...editingSvc, has_meter: e.target.checked })} />
          <label className="form-check-label" htmlFor="hasMeter">Has meter (reading required)</label>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal title="Delete Service" show={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} confirmLabel="Delete" confirmVariant="danger">
        Are you sure? All associated tariffs will also be deleted.
      </Modal>

      {/* Tariff modal */}
      <Modal title="Add Tariff" show={showTariffModal} onClose={() => setShowTariffModal(false)} onConfirm={saveTariff}>
        <div className="mb-3">
          <label className="form-label">Price per unit *</label>
          <input className="form-control" type="number" step="0.0001" value={tariffForm.price_per_unit}
            onChange={(e) => setTariffForm({ ...tariffForm, price_per_unit: Number(e.target.value) })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Valid from *</label>
          <input className="form-control" type="date" value={tariffForm.valid_from}
            onChange={(e) => setTariffForm({ ...tariffForm, valid_from: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Valid to <span className="text-muted">(leave empty = active)</span></label>
          <input className="form-control" type="date" value={tariffForm.valid_to}
            onChange={(e) => setTariffForm({ ...tariffForm, valid_to: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Note</label>
          <input className="form-control" value={tariffForm.note}
            onChange={(e) => setTariffForm({ ...tariffForm, note: e.target.value })} />
        </div>
      </Modal>
    </>
  );
}
