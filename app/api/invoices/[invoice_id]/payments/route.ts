// app/api/invoices/[invoice_id]/payments/route.ts
// Invoice Payments API - List and create payments for an invoice

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

// GET /api/invoices/[invoice_id]/payments - List payments for an invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoice_id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { invoice_id } = await params;

    const { data, error } = await supabase
      .from("payments")
      .select(`
        *,
        creator:profiles!payments_created_by_fkey(full_name)
      `)
      .eq("invoice_id", invoice_id)
      .order("payment_date", { ascending: false });

    if (error) {
      console.error("Error fetching payments:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error("Payments API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/invoices/[invoice_id]/payments - Create payment for an invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invoice_id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only finance and super admin can create payments
    if (profile.role_name !== "finance" && profile.role_name !== "super admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { invoice_id } = await params;
    const body = await request.json();
    const { payment_date, amount, payment_method, reference_no, notes } = body;

    // Validate required fields
    if (!payment_date || !amount) {
      return NextResponse.json({ error: "Missing required fields: payment_date, amount" }, { status: 400 });
    }

    // Verify invoice exists and get outstanding amount.  Use the v_invoice_aging view
    // instead of v_invoice_outstanding.  The view returns an `outstanding` field
    // representing the remaining balance on the invoice.  This allows us to also
    // retrieve other metadata (like days_overdue) if needed.
    const { data: invoiceData, error: invoiceError } = await supabase
      .from("v_invoice_aging")
      .select("invoice_id, outstanding")
      .eq("invoice_id", invoice_id)
      .single();

    if (invoiceError || !invoiceData) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Warn if payment exceeds outstanding (but allow it).  Use the `outstanding`
    // field from v_invoice_aging.  If `outstanding` is null treat as zero.
    const paymentAmount = parseFloat(amount);
    const currentOutstanding = parseFloat(invoiceData.outstanding || "0");
    if (paymentAmount > currentOutstanding) {
      console.warn(
        `Payment amount ${paymentAmount} exceeds outstanding ${currentOutstanding} for invoice ${invoice_id}`
      );
    }

    // Create payment
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        invoice_id,
        payment_date,
        amount: paymentAmount,
        payment_method: payment_method || null,
        reference_no: reference_no || null,
        notes: notes || null,
        created_by: profile.user_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating payment:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      table_name: "payments",
      record_id: payment.payment_id.toString(),
      action: "INSERT",
      changed_by: profile.user_id,
      after_data: payment,
    });

    // After inserting a payment, update the invoice status based on remaining
    // outstanding.  Use the v_invoice_aging view to obtain the latest
    // outstanding balance.  If outstanding > 0 then status becomes
    // WAITING_PAYMENT, otherwise it becomes PAID.
    const { data: invoiceSummary, error: summaryError } = await supabase
      .from("v_invoice_aging")
      .select("outstanding")
      .eq("invoice_id", invoice_id)
      .single();
    if (!summaryError && invoiceSummary) {
      const outstanding = parseFloat(invoiceSummary.outstanding || "0");
      const newStatus = outstanding > 0 ? "WAITING_PAYMENT" : "PAID";
      await supabase
        .from("invoices")
        .update({ status: newStatus })
        .eq("invoice_id", invoice_id);
    }

    // Get updated outstanding amount for the response
    const { data: updated } = await supabase
      .from("v_invoice_aging")
      .select("outstanding")
      .eq("invoice_id", invoice_id)
      .single();

    return NextResponse.json(
      {
        payment,
        remaining_outstanding: updated?.outstanding || 0,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Payments API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
