// app/api/customers/[customer_id]/route.ts
// Customer API - Get/Update individual customer

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/customers/[customer_id] - Get a single customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customer_id: string }> }
) {
  try {
    const { customer_id } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("customer_id", customer_id)
      .single();

    if (error) {
      console.error("Error fetching customer:", error);
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Customer GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/customers/[customer_id] - Update a customer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ customer_id: string }> }
) {
  try {
    const { customer_id } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role_name")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    // Only specific roles can update customers (not Director, marketing, ops, or finance)
    const allowedRoles = [
      "super admin",
      "sales manager",
      "salesperson",
      "sales support",
    ];

    if (!allowedRoles.includes(profile.role_name)) {
      return NextResponse.json(
        { error: "Only sales roles and admin can edit customer data" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      company_name,
      npwp,
      pic_name,
      pic_phone,
      pic_email,
      address,
      city,
      country,
    } = body;

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (company_name !== undefined) updateData.company_name = company_name;
    if (npwp !== undefined) updateData.npwp = npwp || null;
    if (pic_name !== undefined) updateData.pic_name = pic_name;
    if (pic_phone !== undefined) updateData.pic_phone = pic_phone;
    if (pic_email !== undefined) updateData.pic_email = pic_email;
    if (address !== undefined) updateData.address = address || null;
    if (city !== undefined) updateData.city = city || null;
    if (country !== undefined) updateData.country = country || null;

    const { data, error } = await supabase
      .from("customers")
      .update(updateData)
      .eq("customer_id", customer_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating customer:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Customer PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
