"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { clientsApi, subscriptionsApi, servicesApi } from "@/lib/api";
import type { Client, Location, ClientBalance, CalculationRow, Subscription, Service } from "@/types";
import Modal from "@/app/_components/Modal";
import Alert from "@/app/_components/Alert";
import Link from "next/link";
import { useLang } from "@/app/_components/LangProvider";
import { t } from "@/lib/i18n";

function ClientDetailContent() {
  const { lang } = useLang();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const clientId = Number(id);

  const [client, setClient] = useState<Client | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [balance, setBalance] = useState<ClientBalance | null>(null);
  const [pending, setPending] = useState<CalculationRow[]>([]);
  const [paid, setPaid] = useState<CalculationRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showLocModal, setShowLocModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locForm, setLocForm] = useState({ name: "", address: "", is_default: false });

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
      const [c, locs, bal, pend, paidCalcs, svcs] = await Promise.all([
        clientsApi.get(clientId),
        clientsApi.listLocations(clientId),
        clientsApi.balance(clientId),
        clientsApi.pending(clientId),
        clientsApi.paid(clientId),
        servicesApi.list(),
      ]);
      setClient(c); setLocations(locs); setBalance(bal); setPending(pend); setPaid(paidCalcs); setServices(svcs);

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

  if (!client) return <div className="text-center p-5 text-muted">{t("common.loading", lang)}</div>;

  return (
    <>
      <div className="bc-page-header">
        <div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
            <Link href="/clients" className="text-decoration-none">{t("clients.title", lang)}</Link> / {client.full_name}
          </div>
          <h1>{client.full_name}</h1>
        </div>
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      <div className="row g-3 mb-3">
        {/* Info */}
        <div className="col-md-4">
          <div className="bc-card">
            <h6 className="text-muted mb-3" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("client_detail.info", lang)}</h6>
            <div className="mb-2"><span className="text-muted me-2">{t("client_detail.account", lang)}:</span><code>{client.account_number}</code></div>
            <div className="mb-2"><span className="text-muted me-2">{t("clients.phone", lang)}:</span>{client.phone || "—"}</div>
            <div className="mb-2"><span className="text-muted me-2">{t("clients.email", lang)}:</span>{client.email || "—"}</div>
            <div><span className="text-muted me-2">{t("common.status", lang)}:</span>
              <span className={`badge ${client.is_active ? "badge-paid" : "badge-cancelled"}`}>
                {client.is_active ? t("common.active", lang) : t("common.inactive", lang)}
              </span>
            </div>
          </div>
        </div>

        {/* Balance */}
        {balance && (
          <div className="col-md-8">
            <div className="bc-card">
              <h6 className="text-muted mb-3" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("client_detail.balance", lang)}</h6>
              <div className="row text-center">
                <div className="col-6">
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#dc2626" }}>{balance.debt.toFixed(2)}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{t("calculations.pending", lang)}</div>
                </div>
                <div className="col-6">
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#059669" }}>{balance.paid_total.toFixed(2)}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{t("calculations.paid", lang)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Locations */}
      <div className="bc-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0" style={{ fontWeight: 600 }}>{t("locations.title", lang)}</h6>
          <button className="btn btn-sm btn-outline-primary" onClick={openAddLocation}>
            <i className="bi bi-plus-lg me-1" /> {t("common.add", lang)}
          </button>
        </div>
        {locations.length === 0 ? (
          <div className="text-muted text-center py-3">{t("locations.no_locations", lang)}</div>
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
                    <button className="btn btn-sm btn-outline-secondary" title={t("common.edit", lang)}
                      onClick={() => openEditLocation(l)}>
                      <i className="bi bi-pencil" />
                    </button>
                  </div>
                  {l.is_default && <span className="badge badge-paid mt-1">{t("locations.is_default", lang)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscriptions */}
      <div className="bc-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0" style={{ fontWeight: 600 }}>{t("subscriptions.title", lang)}</h6>
        </div>
        {locations.length === 0 ? (
          <div className="text-muted text-center py-2" style={{ fontSize: "0.875rem" }}>{t("client_detail.add_location_first", lang)}</div>
        ) : subscriptions.length === 0 ? (
          <div className="text-muted text-center py-2" style={{ fontSize: "0.875rem" }}>{t("subscriptions.no_subscriptions", lang)}</div>
        ) : (
          <table className="table bc-table mb-0">
            <thead>
              <tr>
                <th>{t("locations.title", lang)}</th>
                <th>{t("subscriptions.service", lang)}</th>
                <th>{t("subscriptions.meter_number", lang)}</th>
                <th>{t("subscriptions.connected_at", lang)}</th>
                <th>{t("common.status", lang)}</th>
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
                      ? <span className="badge badge-cancelled">{t("subscriptions.disconnected", lang)}</span>
                      : <span className="badge badge-paid">{t("subscriptions.active", lang)}</span>}
                  </td>
                  <td className="text-end">
                    {!s.disconnected_at && (
                      <button className="btn btn-sm btn-outline-warning me-1" title={t("subscriptions.disconnect", lang)}
                        onClick={() => { setDisconnectId(s.id); setDisconnectDate(new Date().toISOString().split("T")[0]); }}>
                        <i className="bi bi-slash-circle" />
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-danger" title={t("common.delete", lang)}
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
            <label className="form-label mb-1" style={{ fontSize: "0.8rem", color: "#64748b" }}>{t("client_detail.add_subscription_to", lang)}</label>
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
          <h6 className="mb-0" style={{ fontWeight: 600 }}>{t("client_detail.pending_calculations", lang)}</h6>
          <Link href={`/calculations?client_id=${clientId}`} className="btn btn-sm btn-outline-primary">
            <i className="bi bi-calculator me-1" /> {t("client_detail.manage", lang)}
          </Link>
        </div>
        <table className="table bc-table mb-0">
          <thead>
            <tr>
              <th>{t("calculations.service", lang)}</th>
              <th>{t("calculations.location", lang)}</th>
              <th>{t("calculations.period", lang)}</th>
              <th>{t("calculations.prev", lang)}</th>
              <th>{t("calculations.curr", lang)}</th>
              <th>{t("calculations.amount", lang)}</th>
              <th>{t("calculations.note", lang)}</th>
              <th>{t("common.status", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 && (
              <tr><td colSpan={8} className="text-center text-muted p-3">{t("client_detail.no_pending", lang)}</td></tr>
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
                <td><span className={`badge badge-${c.status}`}>{t(`calculations.${c.status}`, lang)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paid calculations history */}
      <div className="bc-card">
        <h6 className="mb-3" style={{ fontWeight: 600 }}>{t("client_detail.payment_history", lang)}</h6>
        <table className="table bc-table mb-0">
          <thead>
            <tr>
              <th>{t("calculations.service", lang)}</th>
              <th>{t("calculations.location", lang)}</th>
              <th>{t("calculations.period", lang)}</th>
              <th>{t("calculations.amount", lang)}</th>
              <th>{t("calculations.note", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {paid.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted p-3">{t("client_detail.no_paid", lang)}</td></tr>
            )}
            {paid.map((c) => (
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
                <td><strong>{c.amount.toFixed(2)}</strong></td>
                <td>{c.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Subscription create modal */}
      <Modal title={t("subscriptions.new", lang)} show={showSubModal} onClose={() => setShowSubModal(false)} onConfirm={saveSubscription}>
        <div className="mb-3">
          <label className="form-label">{t("subscriptions.service", lang)} *</label>
          <select className="form-select" value={subForm.service_id || ""}
            onChange={(e) => setSubForm({ ...subForm, service_id: Number(e.target.value) })}>
            <option value="">— {t("common.select_service", lang)} —</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">{t("subscriptions.meter_number", lang)}</label>
          <input className="form-control" placeholder="e.g. 5248511" value={subForm.meter_number}
            onChange={(e) => setSubForm({ ...subForm, meter_number: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">{t("subscriptions.connected_at", lang)} *</label>
          <input className="form-control" type="date" value={subForm.connected_at}
            onChange={(e) => setSubForm({ ...subForm, connected_at: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">{t("calculations.note", lang)}</label>
          <input className="form-control" value={subForm.note}
            onChange={(e) => setSubForm({ ...subForm, note: e.target.value })} />
        </div>
      </Modal>

      {/* Disconnect modal */}
      <Modal title={t("subscriptions.disconnect_title", lang)} show={disconnectId !== null}
        onClose={() => setDisconnectId(null)} onConfirm={disconnect}
        confirmLabel={t("subscriptions.disconnect", lang)} confirmVariant="warning">
        <div className="mb-3">
          <label className="form-label">{t("subscriptions.disconnection_date", lang)}</label>
          <input className="form-control" type="date" value={disconnectDate}
            onChange={(e) => setDisconnectDate(e.target.value)} />
        </div>
      </Modal>

      {/* Delete subscription modal */}
      <Modal title={t("subscriptions.delete", lang)} show={deleteSubId !== null}
        onClose={() => setDeleteSubId(null)} onConfirm={deleteSub}
        confirmLabel={t("common.delete", lang)} confirmVariant="danger">
        {t("subscriptions.delete_question", lang)}
      </Modal>

      {/* Location modal */}
      <Modal
        title={editingLocation ? t("locations.edit", lang) : t("locations.new", lang)}
        show={showLocModal}
        onClose={() => { setShowLocModal(false); setEditingLocation(null); }}
        onConfirm={saveLocation}
        confirmLabel={editingLocation ? t("common.save", lang) : t("common.create", lang)}
      >
        <div className="mb-3">
          <label className="form-label">{t("locations.name", lang)} *</label>
          <input className="form-control" placeholder={t("locations.placeholder", lang)} value={locForm.name}
            onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">{t("locations.address", lang)}</label>
          <input className="form-control" value={locForm.address}
            onChange={(e) => setLocForm({ ...locForm, address: e.target.value })} />
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="isDefault" checked={locForm.is_default}
            onChange={(e) => setLocForm({ ...locForm, is_default: e.target.checked })} />
          <label className="form-check-label" htmlFor="isDefault">{t("locations.set_default", lang)}</label>
        </div>
      </Modal>

    </>
  );
}


export default function ClientDetailPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-muted">{t("common.loading", "en")}</div>}>
      <ClientDetailContent />
    </Suspense>
  );
}
