import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/dso - Get DSO/AR data
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "summary"; // summary, aging, rolling, my-customers

    if (type === "summary") {
      // Get overall AR summary using v_invoice_aging.  This view provides
      // outstanding (remaining balance) and days_overdue for each invoice.
      const { data: aging, error: agingError } = await supabase
        .from("v_invoice_aging")
        .select("*");

      if (agingError) {
        return NextResponse.json({ error: agingError.message }, { status: 500 });
      }

      // Calculate summary metrics.  Only consider invoices with positive
      // outstanding for AR totals.  Overdue invoices are those with
      // outstanding > 0 and days_overdue > 0.
      const totalAR = aging?.reduce((sum, inv) => sum + parseFloat(inv.outstanding || "0"), 0) || 0;
      const totalOverdue = aging?.filter((inv) => parseFloat(inv.outstanding || "0") > 0 && inv.days_overdue > 0)
        .reduce((sum, inv) => sum + parseFloat(inv.outstanding || "0"), 0) || 0;
      const overdueCount = aging?.filter((inv) => parseFloat(inv.outstanding || "0") > 0 && inv.days_overdue > 0).length || 0;
      const totalInvoices = aging?.length || 0;

      return NextResponse.json({
        total_ar: totalAR,
        total_overdue: totalOverdue,
        overdue_count: overdueCount,
        total_invoices: totalInvoices,
      });
    }

    if (type === "aging") {
      // Get AR aging by customer
      const { data, error } = await supabase
        .from("v_ar_aging")
        .select("*")
        .gt("ar_total", 0)
        .order("ar_total", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Get customer names
      const customerIds = data?.map((a) => a.customer_id) || [];
      const { data: customers } = await supabase
        .from("customers")
        .select("customer_id, company_name")
        .in("customer_id", customerIds);

      const customerMap = new Map(customers?.map((c) => [c.customer_id, c.company_name]) || []);

      // Enrich with customer names
      const enrichedData = data?.map((a) => ({
        ...a,
        company_name: customerMap.get(a.customer_id) || "Unknown",
      }));

      // Calculate bucket totals
      const bucketTotals = {
        bucket_1_30: data?.reduce((sum, a) => sum + parseFloat(a.bucket_1_30 || "0"), 0) || 0,
        bucket_31_60: data?.reduce((sum, a) => sum + parseFloat(a.bucket_31_60 || "0"), 0) || 0,
        bucket_61_90: data?.reduce((sum, a) => sum + parseFloat(a.bucket_61_90 || "0"), 0) || 0,
        bucket_90_plus: data?.reduce((sum, a) => sum + parseFloat(a.bucket_90_plus || "0"), 0) || 0,
      };

      return NextResponse.json({ data: enrichedData, totals: bucketTotals });
    }

    if (type === "rolling") {
      // Get rolling 30-day DSO
      const { data, error } = await supabase
        .from("v_dso_rolling_30")
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    if (type === "my-customers") {
      // Sales role - get AR for their customers only
      const allowedRoles = ["super admin", "Director", "sales manager", "salesperson", "finance"];
      if (!allowedRoles.includes(profile.role_name)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Get my customers AR view
      const { data, error } = await supabase
        .from("v_my_customers_ar")
        .select("*");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    if (type === "payments") {
      // Get recent payments
      const page = parseInt(searchParams.get("page") || "1", 10);
      const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

      const { data, error, count } = await supabase
        .from("payments")
        .select(`
          *,
          invoice:invoices!payments_invoice_id_fkey (
            invoice_id,
            customer_id,
            invoice_amount
          ),
          created_by_profile:profiles!payments_created_by_fkey (full_name)
        `, { count: "exact" })
        .order("payment_date", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Get customer names
      const customerIds = [...new Set(data?.map((p) => p.invoice?.customer_id).filter(Boolean) || [])];
      const { data: customers } = await supabase
        .from("customers")
        .select("customer_id, company_name")
        .in("customer_id", customerIds);

      const customerMap = new Map(customers?.map((c) => [c.customer_id, c.company_name]) || []);

      // Enrich with customer names
      const enrichedData = data?.map((p) => ({
        ...p,
        company_name: customerMap.get(p.invoice?.customer_id) || "Unknown",
      }));

      return NextResponse.json({
        data: enrichedData,
        pagination: {
          page,
          pageSize,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize),
        },
      });
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  } catch (error) {
    console.error("Error in GET /api/dso:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
