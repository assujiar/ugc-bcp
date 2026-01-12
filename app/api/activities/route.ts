import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";
import { validateSort, validatePagination, errorResponse } from "@/lib/api/validation";

// GET /api/activities - List sales activities
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return errorResponse("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const { page, pageSize } = validatePagination(
      searchParams.get("page"),
      searchParams.get("pageSize")
    );
    const prospectId = searchParams.get("prospect_id") || "";
    const activityType = searchParams.get("activity_type") || "";

    // Validate sort parameters against allowed columns
    const sortValidation = validateSort(
      "activities",
      searchParams.get("sortBy"),
      searchParams.get("sortOrder"),
      "created_at"
    );

    if (!sortValidation.valid) {
      return sortValidation.error;
    }

    const { sortBy, sortOrder } = sortValidation.result;

    let query = supabase
      .from("sales_activities")
      .select(`
        *,
        prospect:prospects!sales_activities_prospect_id_fkey (
          prospect_id,
          current_stage,
          customer:customers!prospects_customer_id_fkey (company_name)
        ),
        created_by_profile:profiles!sales_activities_created_by_fkey (full_name, role_name)
      `, { count: "exact" });

    // Apply filters
    if (prospectId) {
      query = query.eq("prospect_id", prospectId);
    }
    if (activityType) {
      query = query.eq("activity_type", activityType);
    }

    // Apply sorting (validated against allowed columns)
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching activities:", error);
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/activities:", error);
    return errorResponse("Internal server error", 500);
  }
}

// POST /api/activities - Log sales activity
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role permission
    const allowedRoles = [
      "super admin",
      "sales manager",
      "salesperson",
      "sales support",
    ];

    if (!allowedRoles.includes(profile.role_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      prospect_id,
      activity_type,
      notes,
      evidence_photo_url,
      gps_lat,
      gps_lng,
    } = body;

    // Validate required fields
    if (!prospect_id || !activity_type || !notes) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate activity type
    const validTypes = ["Visit", "Call", "Online Meeting", "Email", "WhatsApp/Chat Outbound"];
    if (!validTypes.includes(activity_type)) {
      return NextResponse.json({ error: "Invalid activity type" }, { status: 400 });
    }

    // Visit requires photo and GPS
    if (activity_type === "Visit" && (!evidence_photo_url || !gps_lat || !gps_lng)) {
      return NextResponse.json({ 
        error: "Visit activity requires evidence_photo_url, gps_lat, and gps_lng" 
      }, { status: 400 });
    }

    // Create activity
    const { data: activity, error } = await supabase
      .from("sales_activities")
      .insert({
        prospect_id,
        activity_type,
        notes,
        evidence_photo_url: evidence_photo_url || null,
        gps_lat: gps_lat || null,
        gps_lng: gps_lng || null,
        created_by: profile.user_id,
      })
      .select(`
        *,
        prospect:prospects!sales_activities_prospect_id_fkey (
          prospect_id,
          current_stage,
          customer:customers!prospects_customer_id_fkey (company_name)
        )
      `)
      .single();

    if (error) {
      console.error("Error creating activity:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "sales_activities",
      record_id: activity.activity_id.toString(),
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: activity,
    });

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/activities:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
