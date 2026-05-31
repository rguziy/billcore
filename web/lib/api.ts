const BASE = process.env.API_URL ?? "http://localhost:8080";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  // Go returns null for empty slices — normalize to []
  if (data === null && path !== undefined) return [] as unknown as T;
  return data;
}

// --- Clients ---
import type { Client, Location, ClientBalance, Calculation, Payment } from "@/types";

export const clientsApi = {
  list: () => request<Client[]>("/clients"),
  get: (id: number) => request<Client>(`/clients/${id}`),
  create: (data: Omit<Client, "id" | "created_at" | "updated_at" | "is_active">) =>
    request<Client>("/clients", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Client>) =>
    request<Client>(`/clients/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/clients/${id}`, { method: "DELETE" }),

  // Locations
  listAllLocations: () => request<Location[]>("/locations"),
  listLocations: (clientId: number) => request<Location[]>(`/clients/${clientId}/locations`),
  createLocation: (clientId: number, data: Omit<Location, "id" | "client_id" | "created_at">) =>
    request<Location>(`/clients/${clientId}/locations`, { method: "POST", body: JSON.stringify(data) }),
  updateLocation: (id: number, data: Partial<Location>) =>
    request<Location>(`/locations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteLocation: (id: number) => request<void>(`/locations/${id}`, { method: "DELETE" }),

  // Reports
  balance: (clientId: number) => request<ClientBalance>(`/clients/${clientId}/balance`),
  pending: (clientId: number) => request<Calculation[]>(`/clients/${clientId}/pending`),
  payments: (clientId: number) => request<Payment[]>(`/clients/${clientId}/payments`),
  createPayment: (clientId: number, data: Omit<Payment, "id" | "client_id" | "paid_at">) =>
    request<Payment>(`/clients/${clientId}/payments`, { method: "POST", body: JSON.stringify(data) }),
};

// --- Services ---
import type { Service, Tariff } from "@/types";

export const servicesApi = {
  list: () => request<Service[]>("/services"),
  create: (data: Omit<Service, "id">) =>
    request<Service>("/services", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Service>) =>
    request<Service>(`/services/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/services/${id}`, { method: "DELETE" }),

  // Tariffs
  listTariffs: (serviceId: number) => request<Tariff[]>(`/services/${serviceId}/tariffs`),
  createTariff: (serviceId: number, data: Omit<Tariff, "id" | "service_id">) =>
    request<Tariff>(`/services/${serviceId}/tariffs`, { method: "POST", body: JSON.stringify(data) }),
};

// --- Subscriptions ---
import type { Subscription } from "@/types";

export const subscriptionsApi = {
  listAll: () => request<Subscription[]>("/subscriptions"),
  listByLocation: (locationId: number) =>
    request<Subscription[]>(`/locations/${locationId}/subscriptions`),
  create: (locationId: number, data: Omit<Subscription, "id" | "location_id">) =>
    request<Subscription>(`/locations/${locationId}/subscriptions`, {
      method: "POST", body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<Subscription>) =>
    request<Subscription>(`/subscriptions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  disconnect: (id: number, date: string) =>
    request<void>(`/subscriptions/${id}/disconnect`, {
      method: "PATCH", body: JSON.stringify({ date }),
    }),
  delete: (id: number) => request<void>(`/subscriptions/${id}`, { method: "DELETE" }),
};

// --- Calculations ---
export const calculationsApi = {
  listBySubscription: (subscriptionId: number) =>
    request<Calculation[]>(`/subscriptions/${subscriptionId}/calculations`),
  updateStatus: (id: number, status: string) =>
    request<void>(`/calculations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
};
