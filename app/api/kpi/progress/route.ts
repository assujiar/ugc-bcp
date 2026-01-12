import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/kpi/progress - Get KPI actuals/progress for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get("period_start");
    const periodEnd = searchParams.get("period_end");
    const metricKey = searchParams.get("metric_key");
    const userId = searchParams.get("user_id");

    // Determine which user's data to fetch
    const targetUserId = userId || profile.user_id;

    // Check permission - only managers/admin can view other users' data
    if (targetUserId !== profile.user_id) {
      const allowedRoles = ["super admin", "Director", "Marketing Manager", "sales manager"];
      if (!allowedRoles.includes(profile.role_name)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Fetch from v_kpi_progress view
    let query = supabase
      .from("v_kpi_progress")
      .select("*");

    // Filter by assignee
    if (targetUserId) {
      query = query.eq("assignee_user_id", targetUserId);
    }

    if (periodStart) {
      query = query.gte("period_start", periodStart);
    }
    if (periodEnd) {
      query = query.lte("period_end", periodEnd);
    }
    if (metricKey) {
      query = query.eq("metric_key", metricKey);
    }

    query = query.order("period_start", { ascending: false });

    const { data, error } = await query;

    if (error) {
      // Fallback: if view doesn't exist yet, fetch from kpi_actuals directly
      if (error.message.includes("v_kpi_progress")) {
        const { data: actualsData, error: actualsError } = await supabase
          .from("kpi_actuals")
          .select("*")
          .eq("user_id", targetUserId)
          .order("period_start", { ascending: false });

        if (actualsError) {
          console.error("Error fetching kpi_actuals:", actualsError);
          return NextResponse.json({ error: actualsError.message }, { status: 500 });
        }

        // Include fallback_used flag to indicate the view is unavailable
        return NextResponse.json({
          data: actualsData || [],
          fallback_used: true,
          fallback_reason: "v_kpi_progress view is not available, using kpi_actuals table directly",
        });
      }

      console.error("Error fetching kpi_progress:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], fallback_used: false });
  } catch (error) {
    console.error("Error in GET /api/kpi/progress:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/kpi/progress - Update KPI progress via RPC
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { metric_key, period_start, period_end, value, notes } = body;

    // Validate required fields
    if (!metric_key) {
      return NextResponse.json({ error: "metric_key is required" }, { status: 400 });
    }
    if (!period_start || !period_end) {
      return NextResponse.json({ error: "period_start and period_end are required" }, { status: 400 });
    }
    if (value === undefined || value === null) {
      return NextResponse.json({ error: "value is required" }, { status: 400 });
    }

    // Call atomic RPC for upsert
    const { data: result, error: rpcError } = await supabase.rpc(
      "kpi_update_manual_progress",
      {
        p_metric_key: metric_key,
        p_period_start: period_start,
        p_period_end: period_end,
        p_value: value,
        p_notes: notes || null,
      }
    );

    if (rpcError) {
      console.error("Error in kpi_update_manual_progress:", rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // Check RPC result
    if (result && !result.success) {
      return NextResponse.json({ error: result.error || "Failed to update progress" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      actual_id: result?.actual_id,
      metric_key: result?.metric_key,
      value: result?.value,
    });
  } catch (error) {
    console.error("Error in POST /api/kpi/progress:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
