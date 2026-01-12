import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

interface DedupMatch {
  type: "lead" | "customer";
  id: string;
  company_name: string;
  pic_name: string;
  email?: string;
  phone?: string;
  status?: string;
  match_field: "email" | "phone";
}

// GET /api/leads/dedup - Check for duplicate leads/customers
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const phone = searchParams.get("phone");

    if (!email && !phone) {
      return NextResponse.json({
        exists: false,
        count: 0,
        matches: []
      });
    }

    // Try to use the RPC function first
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "crm_check_duplicate",
        {
          p_email: email || null,
          p_phone: phone || null,
        }
      );

      if (!rpcError && rpcResult) {
        return NextResponse.json({ ...rpcResult, fallback_used: false });
      }
    } catch {
      // RPC might not exist yet, fall back to direct query
    }

    // Fallback: Direct query
    const matches: DedupMatch[] = [];

    // Check leads by email
    if (email) {
      const { data: leadsByEmail } = await supabase
        .from("leads")
        .select("lead_id, company_name, pic_name, email, status")
        .ilike("email", email)
        .limit(10);

      if (leadsByEmail) {
        leadsByEmail.forEach((lead) => {
          matches.push({
            type: "lead",
            id: lead.lead_id,
            company_name: lead.company_name,
            pic_name: lead.pic_name,
            email: lead.email,
            status: lead.status,
            match_field: "email",
          });
        });
      }

      // Check customers by email
      const { data: customersByEmail } = await supabase
        .from("customers")
        .select("customer_id, company_name, pic_name, pic_email")
        .ilike("pic_email", email)
        .limit(10);

      if (customersByEmail) {
        customersByEmail.forEach((customer) => {
          matches.push({
            type: "customer",
            id: customer.customer_id,
            company_name: customer.company_name,
            pic_name: customer.pic_name,
            email: customer.pic_email,
            match_field: "email",
          });
        });
      }
    }

    // Check leads by phone
    if (phone) {
      const { data: leadsByPhone } = await supabase
        .from("leads")
        .select("lead_id, company_name, pic_name, contact_phone, status")
        .eq("contact_phone", phone)
        .limit(10);

      if (leadsByPhone) {
        leadsByPhone.forEach((lead) => {
          // Avoid duplicates if already matched by email
          const alreadyMatched = matches.some(
            (m) => m.type === "lead" && m.id === lead.lead_id
          );
          if (!alreadyMatched) {
            matches.push({
              type: "lead",
              id: lead.lead_id,
              company_name: lead.company_name,
              pic_name: lead.pic_name,
              phone: lead.contact_phone,
              status: lead.status,
              match_field: "phone",
            });
          }
        });
      }

      // Check customers by phone
      const { data: customersByPhone } = await supabase
        .from("customers")
        .select("customer_id, company_name, pic_name, pic_phone")
        .eq("pic_phone", phone)
        .limit(10);

      if (customersByPhone) {
        customersByPhone.forEach((customer) => {
          // Avoid duplicates if already matched by email
          const alreadyMatched = matches.some(
            (m) => m.type === "customer" && m.id === customer.customer_id
          );
          if (!alreadyMatched) {
            matches.push({
              type: "customer",
              id: customer.customer_id,
              company_name: customer.company_name,
              pic_name: customer.pic_name,
              phone: customer.pic_phone,
              match_field: "phone",
            });
          }
        });
      }
    }

    return NextResponse.json({
      exists: matches.length > 0,
      count: matches.length,
      matches,
      fallback_used: true,
      fallback_reason: "crm_check_duplicate RPC is not available, using direct query",
    });
  } catch (error) {
    console.error("Error in GET /api/leads/dedup:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
