"use client";

import React, { useEffect, useState } from "react";
import { servicesApi } from "@/lib/api";
import { useLang } from "@/app/_components/LangProvider";
import { t } from "@/lib/i18n";
import type { Service, Tariff } from "@/types";
import Modal from "@/app/_components/Modal";
import Alert from "@/app/_components/Alert";

const emptyService = (): Partial<Service> => ({ name: "", unit: "", has_meter: false });
const emptyTariff = () => ({
  price_per_unit: 0,
  valid_from: new Date().toISOString().split("T")[0],
  valid_to: "",
  note: "",
});
const toDateInput = (value?: string) => value ? value.split("T")[0] : "";

export default function ServicesPage() {
  const { lang } = useLang();
  const [services, setServices] = useState<Service[]>([]);
  // active tariff per service — loaded upfront for table display
  const [activeTariffs, setActiveTariffs] = useState<Record<number, Tariff | null>>({});
  const [tariffs, setTariffs] = useState<Record<number, Tariff[]>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // service modal
  const [showSvcModal, setShowSvcModal] = useState(false);
  const [editingSvc, setEditingSvc] = useState<Partial<Service>>(emptyService());
  const [isEditSvc, setIsEditSvc] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // initial tariff (only on create)
  const [withTariff, setWithTariff] = useState(true);
  const [initTariff, setInitTariff] = useState(emptyTariff());

  // tariff modal
  const [showTariffModal, setShowTariffModal] = useState(false);
  const [tariffServiceId, setTariffServiceId] = useState<number | null>(null);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [tariffForm, setTariffForm] = useState(emptyTariff());
  const [deleteTariffId, setDeleteTariffId] = useState<number | null>(null);

  const load = async () => {
    try {
      const svcs = await servicesApi.list();
      setServices(svcs);
      // load active tariff for each service in parallel
      const entries = await Promise.all(
        svcs.map(async (s) => {
          const tariffs = await servicesApi.listTariffs(s.id);
          const active = tariffs.find((t) => !t.valid_to) ?? null;
          return [s.id, active] as [number, Tariff | null];
        })
      );
      setActiveTariffs(Object.fromEntries(entries));
    } catch (e: any) { setError(e.message); }
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

  const openCreate = () => {
    setEditingSvc(emptyService());
    setIsEditSvc(false);
    setWithTariff(true);
    setInitTariff(emptyTariff());
    setShowSvcModal(true);
  };
  const openEdit = (s: Service) => { setEditingSvc(s); setIsEditSvc(true); setShowSvcModal(true); };

  const saveSvc = async () => {
    try {
      if (isEditSvc && editingSvc.id) {
        await servicesApi.update(editingSvc.id, editingSvc);
      } else {
        const created = await servicesApi.create(editingSvc as any);
        // create initial tariff if provided
        if (withTariff && initTariff.price_per_unit > 0) {
          await servicesApi.createTariff(created.id, {
            ...initTariff,
            valid_to: initTariff.valid_to || undefined,
          } as any);
        }
      }
      setShowSvcModal(false);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try { await servicesApi.delete(deleteId); setDeleteId(null); load(); }
    catch (e: any) { setError(e.message); }
  };

  const refreshTariffs = async (serviceId: number) => {
    const t = await servicesApi.listTariffs(serviceId);
    setTariffs((prev) => ({ ...prev, [serviceId]: t }));
    const active = t.find((x) => !x.valid_to) ?? null;
    setActiveTariffs((prev) => ({ ...prev, [serviceId]: active }));
  };

  const openTariffCreate = (serviceId: number) => {
    setTariffServiceId(serviceId);
    setEditingTariff(null);
    setTariffForm(emptyTariff());
    setShowTariffModal(true);
  };

  const openTariffEdit = (tariff: Tariff) => {
    setTariffServiceId(tariff.service_id);
    setEditingTariff(tariff);
    setTariffForm({
      price_per_unit: tariff.price_per_unit,
      valid_from: toDateInput(tariff.valid_from),
      valid_to: toDateInput(tariff.valid_to),
      note: tariff.note ?? "",
    });
    setShowTariffModal(true);
  };

  const saveTariff = async () => {
    if (!tariffServiceId) return;
    try {
      const payload = { ...tariffForm, valid_to: tariffForm.valid_to || undefined } as any;
      if (editingTariff) await servicesApi.updateTariff(editingTariff.id, payload);
      else await servicesApi.createTariff(tariffServiceId, payload);
      await refreshTariffs(tariffServiceId);
      setEditingTariff(null);
      setShowTariffModal(false);
    } catch (e: any) { setError(e.message); }
  };

  const confirmTariffDelete = async () => {
    if (!deleteTariffId) return;
    const tariff = Object.values(tariffs).flat().find((t) => t.id === deleteTariffId);
    try {
      await servicesApi.deleteTariff(deleteTariffId);
      setDeleteTariffId(null);
      if (tariff) await refreshTariffs(tariff.service_id);
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
                <th>Current tariff</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted p-4">No services yet</td></tr>
              )}
              {services.map((s) => {
                const active = activeTariffs[s.id];
                return (
                  <React.Fragment key={s.id}>
                    <tr>
                      <td className="ps-3 fw-semibold">{s.name}</td>
                      <td><code>{s.unit}</code></td>
                      <td>
                        {s.has_meter
                          ? <span className="badge badge-paid">Yes</span>
                          : <span className="badge" style={{ background: "#f1f5f9", color: "#64748b" }}>No</span>}
                      </td>
                      <td>
                        {active
                          ? (
                            <span>
                              <strong>{active.price_per_unit}</strong>
                              <span className="text-muted ms-1" style={{ fontSize: "0.8rem" }}>
                                / {s.unit} · from {new Date(active.valid_from).toLocaleDateString()}
                              </span>
                            </span>
                          )
                          : (
                            <span style={{ color: "#dc2626", fontSize: "0.85rem" }}>
                              <i className="bi bi-exclamation-triangle me-1" />
                              No active tariff
                            </span>
                          )
                        }
                      </td>
                      <td className="text-end pe-3">
                        <button className="btn btn-sm btn-outline-secondary me-1" title="Tariff history"
                          onClick={() => toggleExpand(s)}>
                          <i className={`bi bi-clock-history`} />
                        </button>
                        <button className="btn btn-sm btn-outline-primary me-1" title="Add tariff"
                          onClick={() => openTariffCreate(s.id)}>
                          <i className="bi bi-plus-lg" />
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
                      <tr style={{ background: "#f8fafc" }}>
                        <td colSpan={5} className="px-4 py-3">
                          <strong style={{ fontSize: "0.85rem" }}>Tariff history</strong>
                          {!tariffs[s.id]?.length ? (
                            <div className="text-muted mt-2" style={{ fontSize: "0.85rem" }}>No tariffs</div>
                          ) : (
                            <table className="table table-sm mt-2 mb-0">
                              <thead>
                                <tr>
                                  <th>Price / unit</th>
                                  <th>Valid from</th>
                                  <th>Valid to</th>
                                  <th>Note</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {tariffs[s.id].map((t) => (
                                  <tr key={t.id}>
                                    <td><strong>{t.price_per_unit}</strong></td>
                                    <td>{new Date(t.valid_from).toLocaleDateString()}</td>
                                    <td>
                                      {t.valid_to
                                        ? new Date(t.valid_to).toLocaleDateString()
                                        : <span className="badge badge-paid">Active</span>}
                                    </td>
                                    <td>{t.note || "—"}</td>
                                    <td className="text-end">
                                      <button className="btn btn-sm btn-outline-secondary me-1"
                                        onClick={() => openTariffEdit(t)}>
                                        <i className="bi bi-pencil" />
                                      </button>
                                      <button className="btn btn-sm btn-outline-danger"
                                        onClick={() => setDeleteTariffId(t.id)}>
                                        <i className="bi bi-trash" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Service modal */}
      <Modal
        title={isEditSvc ? "Edit Service" : "New Service"}
        show={showSvcModal}
        onClose={() => setShowSvcModal(false)}
        onConfirm={saveSvc}
      >
        <div className="mb-3">
          <label className="form-label">Name *</label>
          <input className="form-control" value={editingSvc.name ?? ""}
            onChange={(e) => setEditingSvc({ ...editingSvc, name: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Unit *</label>
          <input className="form-control" placeholder="m³, kWh, month"
            value={editingSvc.unit ?? ""}
            onChange={(e) => setEditingSvc({ ...editingSvc, unit: e.target.value })} />
        </div>
        <div className="form-check mb-3">
          <input className="form-check-input" type="checkbox" id="hasMeter"
            checked={editingSvc.has_meter ?? false}
            onChange={(e) => setEditingSvc({ ...editingSvc, has_meter: e.target.checked })} />
          <label className="form-check-label" htmlFor="hasMeter">Has meter (reading required)</label>
        </div>

        {/* Initial tariff — only on create */}
        {!isEditSvc && (
          <>
            <hr />
            <div className="form-check mb-3">
              <input className="form-check-input" type="checkbox" id="withTariff"
                checked={withTariff}
                onChange={(e) => setWithTariff(e.target.checked)} />
              <label className="form-check-label fw-semibold" htmlFor="withTariff">
                Set initial tariff now
              </label>
              <div className="form-text">Calculations cannot be generated without an active tariff.</div>
            </div>
            {withTariff && (
              <>
                <div className="mb-3">
                  <label className="form-label">Price per unit *</label>
                  <input className="form-control" type="number" step="0.0001"
                    value={initTariff.price_per_unit || ""}
                    placeholder="e.g. 25.38"
                    onChange={(e) => setInitTariff({ ...initTariff, price_per_unit: Number(e.target.value) })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Valid from *</label>
                  <input className="form-control" type="date"
                    value={initTariff.valid_from}
                    onChange={(e) => setInitTariff({ ...initTariff, valid_from: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Note</label>
                  <input className="form-control" value={initTariff.note}
                    placeholder="Optional"
                    onChange={(e) => setInitTariff({ ...initTariff, note: e.target.value })} />
                </div>
              </>
            )}
          </>
        )}
      </Modal>

      {/* Delete service */}
      <Modal title="Delete Service" show={deleteId !== null}
        onClose={() => setDeleteId(null)} onConfirm={confirmDelete}
        confirmLabel="Delete" confirmVariant="danger">
        Are you sure? All associated tariffs will also be deleted.
      </Modal>

      {/* Tariff modal */}
      <Modal
        title={editingTariff
          ? `Edit Tariff — ${services.find((s) => s.id === tariffServiceId)?.name ?? ""}`
          : `Add Tariff — ${services.find((s) => s.id === tariffServiceId)?.name ?? ""}`}
        show={showTariffModal}
        onClose={() => { setShowTariffModal(false); setEditingTariff(null); }}
        onConfirm={saveTariff}
        confirmLabel={editingTariff ? "Save" : "Create"}
      >
        <div className="mb-3">
          <label className="form-label">Price per unit *</label>
          <input className="form-control" type="number" step="0.0001"
            value={tariffForm.price_per_unit}
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

      {/* Delete tariff */}
      <Modal title="Delete Tariff" show={deleteTariffId !== null}
        onClose={() => setDeleteTariffId(null)} onConfirm={confirmTariffDelete}
        confirmLabel="Delete" confirmVariant="danger">
        Delete this tariff only if it is not used by calculations.
      </Modal>
    </>
  );
}
