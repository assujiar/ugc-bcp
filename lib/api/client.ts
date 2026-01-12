// lib/api/client.ts
// API client utilities for fetching data from route handlers

type FetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  params?: Record<string, string | number | boolean | undefined>;
};

async function apiClient<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { method = "GET", body, params } = options;

    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      return { data: null, error: data.error || "Request failed" };
    }

    return { data, error: null };
  } catch (err) {
    console.error("API client error:", err);
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ==========================================
// Dashboard API
// ==========================================

export interface DashboardData {
  role: string;
  period_days: number;
  total_leads: number;
  leads_by_channel: Record<string, number>;
  open_tickets: number;
  avg_response_time_minutes: number | null;
  total_marketing_spend?: number;
  avg_cpl?: number;
  total_revenue?: number;
  active_customers?: number;
  new_logos?: number;
  activities_by_type?: Record<string, number>;
  total_activities?: number;
  ticket_status_counts?: {
    open: number;
    in_progress: number;
    closed: number;
    closed_lost: number;
  };
  dso_days?: number | null;
  ar_outstanding?: number;
  ar_aging?: {
    bucket_1_30: number;
    bucket_31_60: number;
    bucket_61_90: number;
    bucket_90_plus: number;
  };
}

export async function fetchDashboard(period: number = 30) {
  return apiClient<DashboardData>("/api/dashboard", {
    params: { period },
  });
}

// ==========================================
// Leads API
// ==========================================

export interface Lead {
  lead_id: string;
  lead_date: string;
  company_name: string;
  pic_name: string;
  contact_phone: string;
  email: string;
  city_area: string;
  service_code: string;
  route?: string;
  est_volume_value?: number;
  est_volume_unit?: string;
  timeline?: string;
  sourced_by: string;
  primary_channel: string;
  campaign_name?: string;
  notes?: string;
  sales_owner_user_id?: string;
  customer_id?: string;
  prospect_id?: string;
  status: string;
  next_step: string;
  due_date: string;
  created_by: string;
  created_at: string;
  customers?: { customer_id: string; company_name: string };
  created_by_profile?: { full_name: string; role_name: string };
  owner_profile?: { full_name: string; role_name: string };
  creator?: { full_name: string; role_name: string };
  sales_owner?: { full_name: string; role_name: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function fetchLeads(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  channel?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  return apiClient<PaginatedResponse<Lead>>("/api/leads", { params });
}

export async function createLead(data: Partial<Lead> & { need_rfq?: boolean; rfq_dept_target?: string; [key: string]: unknown }) {
  return apiClient<{ lead: Lead; customer_id: string; prospect_id: string; ticket_id?: string }>("/api/leads", {
    method: "POST",
    body: data,
  });
}

export async function updateLead(lead_id: string, data: Partial<Lead>) {
  return apiClient<{ lead: Lead }>("/api/leads", {
    method: "PATCH",
    body: { lead_id, ...data },
  });
}

// ==========================================
// Tickets API
// ==========================================

export interface Ticket {
  ticket_id: string;
  ticket_type: string;
  inquiry_status?: string;
  ticket_status?: string;
  dept_target: string;
  service_code?: string;
  created_by: string;
  assigned_to?: string;
  related_lead_id?: string;
  related_customer_id?: string;
  subject: string;
  description?: string;
  origin_address?: string;
  origin_city?: string;
  origin_country?: string;
  destination_address?: string;
  destination_city?: string;
  destination_country?: string;
  cargo_category?: string;
  cargo_qty?: number;
  cargo_dimensions?: string;
  cargo_weight?: number;
  scope_of_work?: string;
  need_customer_masking?: boolean;
  close_reason?: string;
  competitor_rate?: number;
  customer_budget?: number;
  created_at: string;
  closed_at?: string;
  created_by_profile?: { full_name: string; role_name: string };
  assigned_to_profile?: { full_name: string; role_name: string };
  customer?: { customer_id: string; company_name: string };
}

export interface TicketMessage {
  message_id: number;
  ticket_id: string;
  message: string;
  created_by: string;
  created_at: string;
  created_by_profile?: {
    user_id: string;
    full_name: string;
    role_name: string;
    dept_code: string;
  };
}

export async function fetchTickets(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  ticket_type?: string;
  status?: string;
  dept_target?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  return apiClient<PaginatedResponse<Ticket>>("/api/tickets", { params });
}

export async function createTicket(data: Partial<Ticket>) {
  return apiClient<{ ticket: Ticket }>("/api/tickets", {
    method: "POST",
    body: data,
  });
}

export async function updateTicket(ticket_id: string, data: Partial<Ticket>) {
  return apiClient<{ ticket: Ticket }>("/api/tickets", {
    method: "PATCH",
    body: { ticket_id, ...data },
  });
}

export async function fetchTicketMessages(ticketId: string) {
  return apiClient<{ data: TicketMessage[] }>(`/api/tickets/${ticketId}/messages`);
}

export async function addTicketMessage(ticketId: string, message: string) {
  return apiClient<{ message: TicketMessage }>(`/api/tickets/${ticketId}/messages`, {
    method: "POST",
    body: { message },
  });
}

// ==========================================
// KPI API
// ==========================================

export interface KpiTarget {
  id: number;
  metric_key: string;
  period_start: string;
  period_end: string;
  assignee_user_id?: string;
  target_value: number;
  metric?: {
    metric_key: string;
    owner_role: string;
    unit: string;
    calc_method: string;
    direction: string;
    description: string;
  };
  assignee?: { full_name: string; role_name: string };
}

export async function fetchKpiTargets(params?: {
  type?: string;
  period_start?: string;
  period_end?: string;
  metric_key?: string;
  assignee_user_id?: string;
}) {
  return apiClient<{ data: KpiTarget[] }>("/api/kpi", { params: { type: "targets", ...params } });
}

export async function fetchMyKpi() {
  return apiClient<{ data: KpiTarget[] }>("/api/kpi", { params: { type: "my" } });
}

export async function fetchTeamKpi() {
  return apiClient<{ data: KpiTarget[]; team: { user_id: string; full_name: string; role_name: string }[] }>("/api/kpi", { params: { type: "team" } });
}

export async function createKpiTarget(data: {
  metric_key: string;
  period_start: string;
  period_end: string;
  assignee_user_id?: string;
  target_value: number;
}) {
  return apiClient<{ data: KpiTarget }>("/api/kpi", {
    method: "POST",
    body: { type: "target", ...data },
  });
}

export async function createMarketingActivity(data: {
  activity_name: string;
  channel?: string;
  activity_date: string;
  quantity: number;
  notes?: string;
}) {
  return apiClient<{ data: unknown }>("/api/kpi", {
    method: "POST",
    body: { type: "activity", ...data },
  });
}

export async function createMarketingSpend(data: {
  channel: string;
  spend_date: string;
  amount: number;
  campaign_name?: string;
  notes?: string;
}) {
  return apiClient<{ data: unknown }>("/api/kpi", {
    method: "POST",
    body: { type: "spend", ...data },
  });
}

// KPI Progress/Actuals
export interface KpiProgress {
  target_id?: number;
  metric_key: string;
  period_start: string;
  period_end: string;
  assignee_user_id?: string;
  target_value?: number;
  calc_method?: string;
  direction?: string;
  unit?: string;
  actual_value: number;
  actual_notes?: string;
  actual_updated_at?: string;
}

export interface KpiProgressResponse {
  data: KpiProgress[];
  fallback_used: boolean;
  fallback_reason?: string;
}

export async function fetchKpiProgress(params?: {
  period_start?: string;
  period_end?: string;
  metric_key?: string;
  user_id?: string;
}) {
  return apiClient<KpiProgressResponse>("/api/kpi/progress", { params });
}

export async function updateKpiProgress(data: {
  metric_key: string;
  period_start: string;
  period_end: string;
  value: number;
  notes?: string;
}) {
  return apiClient<{ success: boolean; actual_id?: string; metric_key?: string; value?: number }>("/api/kpi/progress", {
    method: "POST",
    body: data,
  });
}

// Leads Stats
export interface LeadsStats {
  by_status: Record<string, { count: number; assigned?: number; unassigned?: number }>;
  total: number;
  total_assigned: number;
  total_unassigned: number;
  fallback_used?: boolean;
  fallback_reason?: string;
}

export async function fetchLeadsStats(assigneeId?: string) {
  return apiClient<LeadsStats>("/api/leads/stats", {
    params: assigneeId ? { assignee_id: assigneeId } : undefined,
  });
}

// Leads Dedup
export interface DedupMatch {
  type: "lead" | "customer";
  id: string;
  company_name: string;
  pic_name: string;
  email?: string;
  phone?: string;
  status?: string;
  match_field: "email" | "phone";
}

export interface DedupResult {
  exists: boolean;
  count: number;
  matches: DedupMatch[];
  fallback_used?: boolean;
  fallback_reason?: string;
}

export async function checkLeadDuplicate(email?: string, phone?: string) {
  const params: Record<string, string> = {};
  if (email) params.email = email;
  if (phone) params.phone = phone;
  return apiClient<DedupResult>("/api/leads/dedup", { params });
}

// ==========================================
// Invoices & DSO API
// ==========================================

export interface Invoice {
  invoice_id: string;
  customer_id: string;
  invoice_date: string;
  due_date: string;
  invoice_amount: number;
  paid_amount?: number;
  outstanding_amount?: number;
  is_overdue?: boolean;
  days_past_due?: number;
  company_name?: string;
  customer?: { customer_id: string; company_name: string };
}

export interface Payment {
  payment_id: number;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method?: string;
  reference_no?: string;
  notes?: string;
  created_at?: string;
  created_by?: string;
  created_by_profile?: { full_name: string };
  invoice?: {
    invoice_id: string;
    invoice_amount: number;
    customer?: { customer_id: string; company_name: string };
  };
}

export async function fetchInvoices(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  customer_id?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  return apiClient<PaginatedResponse<Invoice>>("/api/invoices", { params });
}

export async function createInvoice(data: {
  customer_id: string;
  invoice_date: string;
  due_date: string;
  invoice_amount: number;
  currency?: string;
  notes?: string;
}) {
  return apiClient<{ invoice: Invoice }>("/api/invoices", {
    method: "POST",
    body: data,
  });
}

export async function fetchPayments(invoiceId: string) {
  return apiClient<{ data: Payment[]; total_paid: number }>(`/api/invoices/${invoiceId}/payments`);
}

export async function recordPayment(invoiceId: string, data: {
  payment_date: string;
  amount: number;
  payment_method?: string;
  reference_no?: string;
  notes?: string;
}) {
  return apiClient<{
    payment: Payment;
    total_paid: number;
    invoice_amount: number;
    is_fully_paid: boolean;
    is_overpaid: boolean;
  }>(`/api/invoices/${invoiceId}/payments`, {
    method: "POST",
    body: data,
  });
}

export async function fetchDsoSummary() {
  return apiClient<{
    total_ar: number;
    total_overdue: number;
    overdue_count: number;
    total_invoices: number;
  }>("/api/dso", { params: { type: "summary" } });
}

export async function fetchArAging() {
  return apiClient<{
    data: Array<{
      customer_id: string;
      company_name: string;
      ar_total: number;
      bucket_1_30: number;
      bucket_31_60: number;
      bucket_61_90: number;
      bucket_90_plus: number;
    }>;
    totals: {
      bucket_1_30: number;
      bucket_31_60: number;
      bucket_61_90: number;
      bucket_90_plus: number;
    };
  }>("/api/dso", { params: { type: "aging" } });
}

export async function fetchDsoRolling() {
  return apiClient<{
    data: {
      as_of_date: string;
      ar_outstanding: number;
      revenue_30: number;
      dso_days_rolling_30: number;
    };
  }>("/api/dso", { params: { type: "rolling" } });
}

export async function fetchAllPayments(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  return apiClient<PaginatedResponse<Payment>>("/api/dso", { params: { type: "payments", ...params } });
}

// ==========================================
// Customers API
// ==========================================

export interface Customer {
  customer_id: string;
  company_name: string;
  npwp?: string;
  pic_name: string;
  pic_phone: string;
  pic_email: string;
  address?: string;
  city?: string;
  country?: string;
  created_at: string;
}

export async function fetchCustomers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  return apiClient<PaginatedResponse<Customer>>("/api/customers", { params });
}

export async function createCustomer(data: Partial<Customer>) {
  return apiClient<{ customer: Customer }>("/api/customers", {
    method: "POST",
    body: data,
  });
}

export async function fetchCustomer(customerId: string) {
  return apiClient<Customer>(`/api/customers/${customerId}`);
}

export async function updateCustomer(customerId: string, data: Partial<Customer>) {
  return apiClient<{ customer: Customer }>(`/api/customers/${customerId}`, {
    method: "PATCH",
    body: data,
  });
}

// ==========================================
// Prospects API
// ==========================================

export interface Prospect {
  prospect_id: string;
  customer_id: string;
  owner_user_id: string;
  current_stage: string;
  created_at: string;
  customer?: { customer_id: string; company_name: string; pic_name: string };
  owner?: { user_id: string; full_name: string; role_name: string };
}

export async function fetchProspects(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  stage?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  return apiClient<PaginatedResponse<Prospect>>("/api/prospects", { params });
}

export async function updateProspectStage(prospect_id: string, current_stage: string) {
  return apiClient<{ prospect: Prospect }>("/api/prospects", {
    method: "PATCH",
    body: { prospect_id, current_stage },
  });
}

// ==========================================
// Imports API
// ==========================================

export interface ImportRecord {
  import_id: number;
  module: string;
  file_name: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  status: string;
  uploaded_at: string;
  uploaded_by_profile?: { full_name: string };
}

export async function fetchImports(params?: {
  page?: number;
  pageSize?: number;
  module?: string;
  status?: string;
}) {
  return apiClient<PaginatedResponse<ImportRecord>>("/api/imports", { params });
}

export async function processImport(module: string, file_name: string, rows: Record<string, unknown>[]) {
  return apiClient<{
    import_id: number;
    status: string;
    total_rows: number;
    success_rows: number;
    error_rows: number;
    errors: Array<{ row_number: number; error_message: string }>;
  }>("/api/imports", {
    method: "POST",
    body: { module, file_name, rows },
  });
}

// ==========================================
// Sales Activities API
// ==========================================

export interface SalesActivity {
  activity_id: number;
  prospect_id: string;
  activity_type: string;
  notes: string;
  evidence_photo_url?: string;
  gps_lat?: number;
  gps_lng?: number;
  created_by: string;
  created_at: string;
}

export async function logSalesActivity(data: {
  prospect_id: string;
  activity_type: "Visit" | "Call" | "Online Meeting" | "Email" | "WhatsApp/Chat Outbound";
  notes: string;
  evidence_photo_url?: string;
  gps_lat?: number;
  gps_lng?: number;
}) {
  return apiClient<SalesActivity>("/api/activities", {
    method: "POST",
    body: data,
  });
}

export async function fetchActivities(params: {
  prospect_id?: string;
  activity_type?: string;
  page?: number;
  pageSize?: number;
}) {
  return apiClient<PaginatedResponse<SalesActivity>>("/api/activities", { params });
}
