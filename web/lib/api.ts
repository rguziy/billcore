const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080") + "/api";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("billcore_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...init?.headers },
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

import type {
  Client, ClientPage, Location, ClientBalance, Calculation, CalculationRow,
  Service, Tariff, Subscription, Period, OpenPeriodResponse, User,
} from "@/types";

// --- Auth ---
export const authApi = {
  login: (username: string, password: string) =>
    request<{ token: string; user: { id: number; username: string; email: string; role: "admin" | "operator"; preferred_language?: string } }>(
      "/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }
    ),
  me: () => request<{ user_id: number; username: string; role: string }>("/auth/me"),
  setLanguage: (language: string) =>
    request<{ preferred_language: string }>("/auth/language", { method: "PATCH", body: JSON.stringify({ language }) }),
};

// --- Users ---
export const usersApi = {
  list: () => request<User[]>("/users"),
  get: (id: number) => request<User>(`/users/${id}`),
  create: (data: { username: string; email?: string; password: string; role: string }) =>
    request<User>("/users", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<User>) =>
    request<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  block: (id: number) => request<void>(`/users/${id}/block`, { method: "PATCH" }),
  unblock: (id: number) => request<void>(`/users/${id}/unblock`, { method: "PATCH" }),
  changePassword: (id: number, password: string) =>
    request<void>(`/users/${id}/password`, { method: "PATCH", body: JSON.stringify({ password }) }),
  delete: (id: number) => request<void>(`/users/${id}`, { method: "DELETE" }),
};

// --- Clients ---
export const clientsApi = {
  list: (params?: { search?: string; status?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.status) qs.set("status", params.status);
    if (params?.limit)  qs.set("limit",  String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return request<ClientPage>(`/clients${q ? `?${q}` : ""}`);
  },
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
  pending: (clientId: number) => request<CalculationRow[]>(`/clients/${clientId}/pending`),
  paid: (clientId: number) => request<CalculationRow[]>(`/clients/${clientId}/paid`),
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
  getCalculations: (periodId: number, clientId?: number, locationId?: number) => {
    const qs = new URLSearchParams();
    if (clientId)   qs.set("client_id",   String(clientId));
    if (locationId) qs.set("location_id", String(locationId));
    const q = qs.toString();
    return request<CalculationRow[]>(`/periods/${periodId}/calculations${q ? `?${q}` : ""}`);
  },
};

// --- Statistics ---
export const statisticsApi = {
  get: () => request<{
    clients: { total: number; active: number; inactive: number };
    users: { total: number; admins: number; managers: number; operators: number };
    services: { total: number; without_tariff: number };
    current_period?: {
      period_id: number;
      period_start: string;
      accrued: number;
      paid: number;
      pending: number;
      cancelled: number;
    };
  }>("/statistics"),
};

// --- Calculations ---
export const calculationsApi = {
  listBySubscription: (subscriptionId: number) =>
    request<Calculation[]>(`/subscriptions/${subscriptionId}/calculations`),
  create: (periodId: number, data: {
    subscription_id: number;
    reading_prev?: number;
    reading_curr?: number;
    quantity?: number;
    note?: string;
  }) =>
    request<Calculation>(`/periods/${periodId}/calculations`, {
      method: "POST", body: JSON.stringify(data),
    }),
  updateReading: (id: number, readingCurr: number, readingPrev?: number) =>
    request<void>(`/calculations/${id}/reading`, {
      method: "PATCH",
      body: JSON.stringify({ reading_curr: readingCurr, reading_prev: readingPrev ?? null }),
    }),
  updateStatus: (id: number, status: string) =>
    request<void>(`/calculations/${id}/status`, {
      method: "PATCH", body: JSON.stringify({ status }),
    }),
  updateNote: (id: number, note: string) =>
    request<void>(`/calculations/${id}/note`, {
      method: "PATCH", body: JSON.stringify({ note }),
    }),
  delete: (id: number) => request<void>(`/calculations/${id}`, { method: "DELETE" }),
};
