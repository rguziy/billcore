"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { subscriptionsApi, clientsApi, servicesApi } from "@/lib/api";
import type { Subscription, Client, Service, Location } from "@/types";
import Modal from "@/app/_components/Modal";
import Alert from "@/app/_components/Alert";
import Link from "next/link";
import { useLang } from "@/app/_components/LangProvider";
import { t } from "@/lib/i18n";

function SubscriptionsContent() {
  const { lang } = useLang();
  const searchParams = useSearchParams();
  const [subs, setSubs]         = useState<Subscription[]>([]);
  const [clients, setClients]   = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  // filters — initialise from URL param
  const [filterClient, setFilterClient] = useState<number | "">(
    searchParams.get("client_id") ? Number(searchParams.get("client_id")) : ""
  );

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
      const [s, cp, sv] = await Promise.all([
        subscriptionsApi.listAll(),
        clientsApi.list({ limit: 1000 }),
        servicesApi.list(),
      ]);
      setSubs(s); setClients(cp.clients); setServices(sv);
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
  const locationMap = Object.fromEntries(locations.map((l) => [l.id, l]));

  const [filterLocation, setFilterLocation] = useState<number | "">("");

  // reset location filter when client changes
  useEffect(() => { setFilterLocation(""); }, [filterClient]);

  const filtered = subs.filter((s) => {
    if (filterClient && !locations.some((l) => l.id === s.location_id)) return false;
    if (filterLocation && s.location_id !== filterLocation) return false;
    return true;
  });

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
        <h1>{t("subscriptions.title", lang)}</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm({ location_id: 0, service_id: 0, meter_number: "", connected_at: today(), note: "" }); setShowCreate(true); }}>
          <i className="bi bi-plus-lg me-1" /> {t("subscriptions.new", lang)}
        </button>
      </div>

      <Alert message={error} onClose={() => setError(null)} />

      {/* Filter */}
      <div className="bc-card">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">{t("subscriptions.filter_client", lang)}</label>
            <select className="form-select" value={filterClient}
              onChange={(e) => setFilterClient(e.target.value ? Number(e.target.value) : "")}>
              <option value="">— {t("subscriptions.all_clients", lang)} —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name} ({c.account_number})</option>
              ))}
            </select>
          </div>
          {filterClient && locations.length > 0 && (
            <div className="col-md-4">
              <label className="form-label">{t("subscriptions.filter_location", lang)}</label>
              <select className="form-select" value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value ? Number(e.target.value) : "")}>
                <option value="">— {t("subscriptions.all_locations", lang)} —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}{l.address ? ` (${l.address})` : ""}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bc-card p-0">
        {loading ? (
          <div className="p-4 text-center text-muted">{t("common.loading", lang)}</div>
        ) : (
          <table className="table bc-table mb-0">
            <thead>
              <tr>
                <th className="ps-3">{t("subscriptions.service", lang)}</th>
                <th>{t("calculations.location", lang)}</th>
                <th>{t("subscriptions.meter_number", lang)}</th>
                <th>{t("subscriptions.connected_at", lang)}</th>
                <th>{t("common.status", lang)}</th>
                <th>{t("calculations.note", lang)}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted p-4">{t("subscriptions.no_subscriptions", lang)}</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="ps-3 fw-semibold">{serviceMap[s.service_id]?.name ?? `#${s.service_id}`}</td>
                  <td>{locationMap[s.location_id]?.name ?? `#${s.location_id}`}</td>
                  <td>{s.meter_number ? <code>{s.meter_number}</code> : "—"}</td>
                  <td>{new Date(s.connected_at).toLocaleDateString()}</td>
                  <td>
                    {s.disconnected_at
                      ? <span className="badge badge-cancelled">{t("subscriptions.disconnected", lang)} {new Date(s.disconnected_at).toLocaleDateString()}</span>
                      : <span className="badge badge-paid">{t("subscriptions.active", lang)}</span>}
                  </td>
                  <td>{s.note || "—"}</td>
                  <td className="text-end pe-3">
                    <button className="btn btn-sm btn-outline-secondary me-1" title={t("common.edit", lang)}
                      onClick={() => setEditSub({ ...s })}>
                      <i className="bi bi-pencil" />
                    </button>
                    {!s.disconnected_at && (
                      <button className="btn btn-sm btn-outline-warning me-1" title={t("subscriptions.disconnect", lang)}
                        onClick={() => { setDisconnectId(s.id); setDisconnectDate(today()); }}>
                        <i className="bi bi-slash-circle" />
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-danger" title={t("common.delete", lang)}
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
      <Modal title={t("subscriptions.new", lang)} show={showCreate} onClose={() => setShowCreate(false)} onConfirm={create}>
        <div className="mb-3">
          <label className="form-label">{t("calculations.client", lang)}</label>
          <select className="form-select" value={filterClient || ""}
            onChange={(e) => {
              const cid = Number(e.target.value);
              setFilterClient(cid);
              setForm({ ...form, location_id: 0 });
            }}>
            <option value="">— {t("common.select_client", lang)} —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">{t("calculations.location", lang)} *</label>
          <select className="form-select" value={form.location_id || ""}
            onChange={(e) => setForm({ ...form, location_id: Number(e.target.value) })}>
            <option value="">— {t("common.select_location", lang)} —</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name} {l.address ? `(${l.address})` : ""}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">{t("subscriptions.service", lang)} *</label>
          <select className="form-select" value={form.service_id || ""}
            onChange={(e) => setForm({ ...form, service_id: Number(e.target.value) })}>
            <option value="">— {t("common.select_service", lang)} —</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">{t("subscriptions.meter_number", lang)}</label>
          <input className="form-control" placeholder="e.g. 5248511" value={form.meter_number}
            onChange={(e) => setForm({ ...form, meter_number: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">{t("subscriptions.connected_at", lang)} *</label>
          <input className="form-control" type="date" value={form.connected_at}
            onChange={(e) => setForm({ ...form, connected_at: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">{t("calculations.note", lang)}</label>
          <input className="form-control" value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal title={t("subscriptions.edit", lang)} show={editSub !== null} onClose={() => setEditSub(null)} onConfirm={update}>
        <div className="mb-3">
          <label className="form-label">{t("subscriptions.meter_number", lang)}</label>
          <input className="form-control" value={editSub?.meter_number ?? ""}
            onChange={(e) => setEditSub((prev) => prev ? { ...prev, meter_number: e.target.value } : prev)} />
        </div>
        <div className="mb-3">
          <label className="form-label">{t("calculations.note", lang)}</label>
          <input className="form-control" value={editSub?.note ?? ""}
            onChange={(e) => setEditSub((prev) => prev ? { ...prev, note: e.target.value } : prev)} />
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

      {/* Delete modal */}
      <Modal title={t("subscriptions.delete", lang)} show={deleteId !== null}
        onClose={() => setDeleteId(null)} onConfirm={remove}
        confirmLabel={t("common.delete", lang)} confirmVariant="danger">
        {t("subscriptions.delete_help", lang)}
      </Modal>
    </>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-muted">{t("common.loading", "en")}</div>}>
      <SubscriptionsContent />
    </Suspense>
  );
}
