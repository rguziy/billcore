export interface Client {
  id: number;
  full_name: string;
  phone?: string;
  email?: string;
  account_number: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: number;
  client_id: number;
  name: string;
  address?: string;
  is_default: boolean;
  created_at: string;
  client_name?: string;
  account_number?: string;
}

export interface Service {
  id: number;
  name: string;
  unit: string;
  has_meter: boolean;
}

export interface Tariff {
  id: number;
  service_id: number;
  price_per_unit: number;
  valid_from: string;
  valid_to?: string;
  note?: string;
}

export interface Subscription {
  id: number;
  location_id: number;
  service_id: number;
  meter_number?: string;
  connected_at: string;
  disconnected_at?: string;
  note?: string;
}

export type PeriodStatus = "open" | "closed";

export interface Period {
  id: number;
  period_start: string;
  period_end: string;
  status: PeriodStatus;
  created_at: string;
}

export type CalculationStatus = "pending" | "paid" | "cancelled";

export interface Calculation {
  id: number;
  subscription_id: number;
  period_id: number;
  tariff_id: number;
  reading_prev?: number;
  reading_curr?: number;
  quantity: number;
  amount: number;
  status: CalculationStatus;
  note?: string;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "online";

export interface Payment {
  id: number;
  client_id: number;
  calculation_id?: number;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  note?: string;
}

export interface ClientBalance {
  client_id: number;
  debt: number;
  paid_total: number;
  balance: number;
}

export interface OpenPeriodResponse {
  period: Period;
  generated: number;
}
