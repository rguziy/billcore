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
  if (data === null) return [] as unknown as T;
  return data;
}

// --- Clients ---
import type {
  Client, Location, ClientBalance, Calculation, Payment,
  Service, Tariff, Subscription, Period, OpenPeriodResponse,
} from "@/types";

export const clientsApi = {
  list: () => request<Client[]>("/clients"),
  get: (id: number) => request<Client>(`/clients/${id}`),
  create: (data: Omit<Client, "id" | "created_at" | "updated_at" | "is_active">) =>
    request<Client>("/clients", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Client>) =>
    request<Client>(`/clients/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/clients/${id}`, { method: "DELETE" }),

  listAllLocations: () => request<Location[]>("/locations"),
  listLocations: (clientId: number) => request<Location[]>(`/clients/${clientId}/locations`),
  createLocation: (clientId: number, data: Omit<Location, "id" | "client_id" | "created_at">) =>
    request<Location>(`/clients/${clientId}/locations`, { method: "POST", body: JSON.stringify(data) }),
  updateLocation: (id: number, data: Partial<Location>) =>
    request<Location>(`/locations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteLocation: (id: number) => request<void>(`/locations/${id}`, { method: "DELETE" }),

  balance: (clientId: number) => request<ClientBalance>(`/clients/${clientId}/balance`),
  pending: (clientId: number) => request<Calculation[]>(`/clients/${clientId}/pending`),
  payments: (clientId: number) => request<Payment[]>(`/clients/${clientId}/payments`),
  createPayment: (clientId: number, data: Omit<Payment, "id" | "client_id" | "paid_at">) =>
    request<Payment>(`/clients/${clientId}/payments`, { method: "POST", body: JSON.stringify(data) }),
};

// --- Services ---
export const servicesApi = {
  list: () => request<Service[]>("/services"),
  create: (data: Omit<Service, "id">) =>
    request<Service>("/services", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Service>) =>
    request<Service>(`/services/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/services/${id}`, { method: "DELETE" }),

  listTariffs: (serviceId: number) => request<Tariff[]>(`/services/${serviceId}/tariffs`),
  createTariff: (serviceId: number, data: Omit<Tariff, "id" | "service_id">) =>
    request<Tariff>(`/services/${serviceId}/tariffs`, { method: "POST", body: JSON.stringify(data) }),
  updateTariff: (id: number, data: Partial<Tariff>) =>
    request<Tariff>(`/tariffs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTariff: (id: number) => request<void>(`/tariffs/${id}`, { method: "DELETE" }),
};

// --- Subscriptions ---
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

// --- Periods ---
export const periodsApi = {
  list: () => request<Period[]>("/periods"),
  get: (id: number) => request<Period>(`/periods/${id}`),
  open: (periodStart: string) =>
    request<OpenPeriodResponse>("/periods/open", {
      method: "POST", body: JSON.stringify({ period_start: periodStart }),
    }),
  close: (id: number) => request<void>(`/periods/${id}/close`, { method: "PATCH" }),
  reopen: (id: number) => request<void>(`/periods/${id}/reopen`, { method: "PATCH" }),
  delete: (id: number) => request<void>(`/periods/${id}`, { method: "DELETE" }),

  getCalculations: (periodId: number, clientId?: number) => {
    const qs = clientId ? `?client_id=${clientId}` : "";
    return request<Calculation[]>(`/periods/${periodId}/calculations${qs}`);
  },
};

// --- Calculations ---
export const calculationsApi = {
  listBySubscription: (subscriptionId: number) =>
    request<Calculation[]>(`/subscriptions/${subscriptionId}/calculations`),
  updateReading: (id: number, readingCurr: number) =>
    request<void>(`/calculations/${id}/reading`, {
      method: "PATCH", body: JSON.stringify({ reading_curr: readingCurr }),
    }),
  updateStatus: (id: number, status: string) =>
    request<void>(`/calculations/${id}/status`, {
      method: "PATCH", body: JSON.stringify({ status }),
    }),
  updateNote: (id: number, note: string) =>
    request<void>(`/calculations/${id}/note`, {
      method: "PATCH", body: JSON.stringify({ note }),
    }),
};
