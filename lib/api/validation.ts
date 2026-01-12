// lib/api/validation.ts
// API validation helpers for query parameters and role checks

import { NextResponse } from "next/server";
import type { UserProfile } from "@/lib/types";

// ==========================================
// Sort validation
// ==========================================

// Allowed sortable columns by endpoint
const ALLOWED_SORT_COLUMNS: Record<string, string[]> = {
  activities: ["created_at", "activity_type", "prospect_id"],
  leads: ["created_at", "lead_date", "company_name", "status", "primary_channel", "updated_at"],
  customers: ["created_at", "company_name", "city", "updated_at"],
  invoices: ["created_at", "invoice_date", "due_date", "invoice_amount", "updated_at"],
  payments: ["created_at", "payment_date", "amount"],
  tickets: ["created_at", "ticket_type", "ticket_status", "inquiry_status", "dept_target"],
  prospects: ["created_at", "current_stage", "updated_at"],
  imports: ["uploaded_at", "status", "module"],
  users: ["created_at", "full_name", "role_name", "email"],
};

const ALLOWED_SORT_ORDERS = ["asc", "desc"] as const;
type SortOrder = typeof ALLOWED_SORT_ORDERS[number];

export interface ValidatedSort {
  sortBy: string;
  sortOrder: SortOrder;
}

/**
 * Validates sortBy and sortOrder parameters against allowed values
 * @param endpoint - The endpoint name (e.g., "activities", "leads")
 * @param sortBy - The column to sort by
 * @param sortOrder - The sort direction ("asc" or "desc")
 * @param defaultSortBy - Default column if sortBy is invalid or not provided
 * @returns Validated sort parameters or error response
 */
export function validateSort(
  endpoint: string,
  sortBy: string | null,
  sortOrder: string | null,
  defaultSortBy: string = "created_at"
): { valid: true; result: ValidatedSort } | { valid: false; error: NextResponse } {
  const allowedColumns = ALLOWED_SORT_COLUMNS[endpoint] || ["created_at"];

  // Validate sortBy
  const validatedSortBy = sortBy && allowedColumns.includes(sortBy)
    ? sortBy
    : defaultSortBy;

  // If sortBy was provided but invalid, return error
  if (sortBy && !allowedColumns.includes(sortBy)) {
    return {
      valid: false,
      error: NextResponse.json(
        {
          error: `Invalid sortBy parameter. Allowed values: ${allowedColumns.join(", ")}`
        },
        { status: 400 }
      ),
    };
  }

  // Validate sortOrder
  const normalizedOrder = sortOrder?.toLowerCase();
  if (sortOrder && !ALLOWED_SORT_ORDERS.includes(normalizedOrder as SortOrder)) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Invalid sortOrder parameter. Allowed values: asc, desc" },
        { status: 400 }
      ),
    };
  }

  const validatedSortOrder: SortOrder =
    normalizedOrder === "asc" ? "asc" :
    normalizedOrder === "desc" ? "desc" :
    "desc"; // default

  return {
    valid: true,
    result: {
      sortBy: validatedSortBy,
      sortOrder: validatedSortOrder,
    },
  };
}

// ==========================================
// Role authorization
// ==========================================

// Role groups for easier permission management
export const ROLE_GROUPS = {
  SUPER_ADMIN: ["super admin"],
  DIRECTORS: ["Director"],
  MARKETING_MANAGERS: ["Marketing Manager"],
  MARKETING_STAFF: ["Marcomm (marketing staff)", "DGO (Marketing staff)", "MACX (marketing staff)", "VSDO (marketing staff)"],
  SALES_MANAGERS: ["sales manager"],
  SALES_STAFF: ["salesperson", "sales support"],
  OPS_STAFF: ["EXIM Ops (operation)", "domestics Ops (operation)", "Import DTD Ops (operation)", "traffic & warehous (operation)"],
  FINANCE: ["finance"],
} as const;

// Combined role groups
export const ALL_MARKETING_ROLES = [...ROLE_GROUPS.MARKETING_MANAGERS, ...ROLE_GROUPS.MARKETING_STAFF];
export const ALL_SALES_ROLES = [...ROLE_GROUPS.SALES_MANAGERS, ...ROLE_GROUPS.SALES_STAFF];
export const ALL_OPS_ROLES = [...ROLE_GROUPS.OPS_STAFF];
export const ALL_ADMIN_ROLES = [...ROLE_GROUPS.SUPER_ADMIN, ...ROLE_GROUPS.DIRECTORS];
export const READ_ONLY_ROLES = [...ROLE_GROUPS.DIRECTORS];

/**
 * Checks if the user's role is in the allowed roles list
 * @param profile - User profile with role_name
 * @param allowedRoles - Array of allowed role names
 * @returns true if authorized, false otherwise
 */
export function hasRole(profile: UserProfile | null, allowedRoles: readonly string[]): boolean {
  if (!profile) return false;
  return allowedRoles.includes(profile.role_name);
}

/**
 * Checks if user is a super admin
 */
export function isSuperAdmin(profile: UserProfile | null): boolean {
  return hasRole(profile, ROLE_GROUPS.SUPER_ADMIN);
}

/**
 * Checks if user is a director (read-only role)
 */
export function isDirector(profile: UserProfile | null): boolean {
  return hasRole(profile, ROLE_GROUPS.DIRECTORS);
}

/**
 * Checks if user is a read-only role (e.g., Director)
 */
export function isReadOnly(profile: UserProfile | null): boolean {
  return hasRole(profile, READ_ONLY_ROLES);
}

/**
 * Returns a 403 Forbidden response if the user doesn't have one of the required roles
 * @param profile - User profile
 * @param allowedRoles - Array of allowed role names
 * @param customMessage - Optional custom error message
 * @returns NextResponse with 403 error or null if authorized
 */
export function requireRoles(
  profile: UserProfile | null,
  allowedRoles: readonly string[],
  customMessage?: string
): NextResponse | null {
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(profile, allowedRoles)) {
    return NextResponse.json(
      { error: customMessage || `Access denied. Required roles: ${allowedRoles.join(", ")}` },
      { status: 403 }
    );
  }

  return null; // Authorized
}

/**
 * Returns a 403 Forbidden response if the user is a read-only role (e.g., Director)
 * Use this to block write operations for read-only roles
 */
export function blockReadOnlyRoles(
  profile: UserProfile | null,
  customMessage?: string
): NextResponse | null {
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isReadOnly(profile)) {
    return NextResponse.json(
      { error: customMessage || "This role has read-only access" },
      { status: 403 }
    );
  }

  return null; // Authorized for write
}

// ==========================================
// Common allowed role sets for different operations
// ==========================================

// Roles that can create/update leads
export const LEAD_WRITE_ROLES = [
  ...ROLE_GROUPS.SUPER_ADMIN,
  ...ROLE_GROUPS.MARKETING_MANAGERS,
  ...ROLE_GROUPS.MARKETING_STAFF,
  ...ROLE_GROUPS.SALES_MANAGERS,
  "salesperson",
] as const;

// Roles that can update customers
export const CUSTOMER_WRITE_ROLES = [
  ...ROLE_GROUPS.SUPER_ADMIN,
  ...ROLE_GROUPS.SALES_MANAGERS,
  "salesperson",
  "sales support",
] as const;

// Roles that can create/update invoices
export const INVOICE_WRITE_ROLES = [
  ...ROLE_GROUPS.SUPER_ADMIN,
  ...ROLE_GROUPS.FINANCE,
] as const;

// Roles that can assign/handover leads
export const LEAD_ASSIGN_ROLES = [
  ...ROLE_GROUPS.SUPER_ADMIN,
  ...ROLE_GROUPS.MARKETING_MANAGERS,
  ...ROLE_GROUPS.SALES_MANAGERS,
] as const;

// Roles that can view team KPI data
export const KPI_TEAM_VIEW_ROLES = [
  ...ROLE_GROUPS.SUPER_ADMIN,
  ...ROLE_GROUPS.DIRECTORS,
  ...ROLE_GROUPS.MARKETING_MANAGERS,
  ...ROLE_GROUPS.SALES_MANAGERS,
] as const;

// Roles that can manage users
export const USER_MANAGE_ROLES = [
  ...ROLE_GROUPS.SUPER_ADMIN,
] as const;

// ==========================================
// Input validation helpers
// ==========================================

/**
 * Validates that a string is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validates that a string is a valid date (YYYY-MM-DD)
 */
export function isValidDate(value: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Validates that a value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && value > 0 && isFinite(value);
}

/**
 * Validates pagination parameters and returns sanitized values
 */
export function validatePagination(
  page: string | null,
  pageSize: string | null,
  maxPageSize: number = 100
): { page: number; pageSize: number } {
  const parsedPage = parseInt(page || "1", 10);
  const parsedPageSize = parseInt(pageSize || "20", 10);

  return {
    page: isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage,
    pageSize: isNaN(parsedPageSize) || parsedPageSize < 1
      ? 20
      : Math.min(parsedPageSize, maxPageSize),
  };
}

// ==========================================
// Response helpers
// ==========================================

/**
 * Creates a standardized error response
 */
export function errorResponse(
  message: string,
  status: 400 | 401 | 403 | 404 | 500 = 500
): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Creates a standardized success response with optional fallback flag
 */
export function successResponse<T>(
  data: T,
  options?: { fallback_used?: boolean; message?: string }
): NextResponse {
  const response: Record<string, unknown> = { ...data as object };

  if (options?.fallback_used !== undefined) {
    response.fallback_used = options.fallback_used;
  }

  if (options?.message) {
    response.message = options.message;
  }

  return NextResponse.json(response);
}
