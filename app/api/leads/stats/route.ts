import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/leads/stats - Get pipeline summary stats
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assigneeId = searchParams.get("assignee_id");

    // Determine scoping based on role
    const isSuperAdmin = profile.role_name === "super admin";
    const isDirector = profile.role_name === "Director";
    const isMarketingManager = profile.role_name === "Marketing Manager";
    const isSalesManager = profile.role_name === "sales manager";
    const isSalesperson = profile.role_name === "salesperson";

    // Try to use the RPC function first
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "crm_get_pipeline_stats",
        { p_user_id: isSalesperson ? profile.user_id : null }
      );

      if (!rpcError && rpcResult) {
        // Convert array to object format for easier UI consumption
        const stats: Record<string, { count: number; assigned?: number; unassigned?: number }> = {};

        if (Array.isArray(rpcResult)) {
          rpcResult.forEach((item: { status: string; count: number; assigned?: number; unassigned?: number }) => {
            stats[item.status] = {
              count: item.count,
              assigned: item.assigned,
              unassigned: item.unassigned,
            };
          });
        }

        // Calculate totals
        const total = Object.values(stats).reduce((sum, s) => sum + s.count, 0);
        const totalAssigned = Object.values(stats).reduce((sum, s) => sum + (s.assigned || 0), 0);
        const totalUnassigned = Object.values(stats).reduce((sum, s) => sum + (s.unassigned || 0), 0);

        return NextResponse.json({
          by_status: stats,
          total,
          total_assigned: totalAssigned,
          total_unassigned: totalUnassigned,
          fallback_used: false,
        });
      }
    } catch {
      // RPC might not exist yet, fall back to direct query
    }

    // Fallback: Direct query with role-based scoping
    let query = supabase.from("leads").select("status, sales_owner_user_id");

    // Apply scoping
    if (isSalesperson) {
      query = query.eq("sales_owner_user_id", profile.user_id);
    } else if (assigneeId && (isSuperAdmin || isDirector || isMarketingManager || isSalesManager)) {
      query = query.eq("sales_owner_user_id", assigneeId);
    }
    // For managers/admin without assignee filter, show all leads (RLS will still apply)

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching leads stats:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregate by status
    const stats: Record<string, { count: number; assigned: number; unassigned: number }> = {};

    (data || []).forEach((lead) => {
      const status = lead.status || "New";
      if (!stats[status]) {
        stats[status] = { count: 0, assigned: 0, unassigned: 0 };
      }
      stats[status].count++;
      if (lead.sales_owner_user_id) {
        stats[status].assigned++;
      } else {
        stats[status].unassigned++;
      }
    });

    // Calculate totals
    const total = Object.values(stats).reduce((sum, s) => sum + s.count, 0);
    const totalAssigned = Object.values(stats).reduce((sum, s) => sum + s.assigned, 0);
    const totalUnassigned = Object.values(stats).reduce((sum, s) => sum + s.unassigned, 0);

    return NextResponse.json({
      by_status: stats,
      total,
      total_assigned: totalAssigned,
      total_unassigned: totalUnassigned,
      fallback_used: true,
      fallback_reason: "crm_get_pipeline_stats RPC is not available, using direct query",
    });
  } catch (error) {
    console.error("Error in GET /api/leads/stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
