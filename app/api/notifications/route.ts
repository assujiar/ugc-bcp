import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/auth";

interface Notification {
  id: string;
  type: "lead" | "ticket" | "invoice" | "system";
  title: string;
  message: string;
  href?: string;
  read: boolean;
  created_at: string;
}

// GET /api/notifications - Get recent notifications for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const unreadOnly = searchParams.get("unread") === "true";

    const notifications: Notification[] = [];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get recent leads assigned to user (for sales roles)
    if (["sales manager", "salesperson", "sales support"].includes(profile.role_name)) {
      const { data: recentLeads } = await supabase
        .from("leads")
        .select("lead_id, company_name, primary_channel, created_at")
        .eq("sales_owner_user_id", profile.user_id)
        .gte("created_at", oneWeekAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentLeads) {
        recentLeads.forEach((lead) => {
          const createdAt = new Date(lead.created_at);
          notifications.push({
            id: `lead-${lead.lead_id}`,
            type: "lead",
            title: "New Lead Assigned",
            message: `${lead.company_name} via ${lead.primary_channel}`,
            href: `/crm/leads/${lead.lead_id}`,
            read: createdAt < oneDayAgo,
            created_at: lead.created_at,
          });
        });
      }
    }

    // Get recent tickets assigned to user or in user's department
    const { data: recentTickets } = await supabase
      .from("tickets")
      .select("ticket_id, subject, ticket_type, inquiry_status, ticket_status, created_at, assigned_to, dept_target")
      .or(`assigned_to.eq.${profile.user_id},dept_target.eq.${profile.dept_code}`)
      .gte("created_at", oneWeekAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(5);

    if (recentTickets) {
      recentTickets.forEach((ticket) => {
        const createdAt = new Date(ticket.created_at);
        const status = ticket.inquiry_status || ticket.ticket_status || "OPEN";
        notifications.push({
          id: `ticket-${ticket.ticket_id}`,
          type: "ticket",
          title: ticket.assigned_to === profile.user_id ? "Ticket Assigned" : "New Ticket",
          message: `${ticket.ticket_id}: ${ticket.subject} (${status})`,
          href: `/ticketing/${ticket.ticket_id}`,
          read: createdAt < oneDayAgo,
          created_at: ticket.created_at,
        });
      });
    }

    // Get overdue invoices for finance role
    if (["finance", "super admin", "Director"].includes(profile.role_name)) {
      const { data: overdueInvoices } = await supabase
        .from("v_invoice_aging")
        .select("invoice_id, customer_id, outstanding, days_overdue")
        .gt("outstanding", 0)
        .gt("days_overdue", 0)
        .order("days_overdue", { ascending: false })
        .limit(3);

      if (overdueInvoices) {
        overdueInvoices.forEach((inv) => {
          notifications.push({
            id: `invoice-${inv.invoice_id}`,
            type: "invoice",
            title: "Overdue Invoice",
            message: `${inv.invoice_id} - ${inv.days_overdue} days overdue (Rp ${Number(inv.outstanding).toLocaleString("id-ID")})`,
            href: `/dso/invoices/${inv.invoice_id}`,
            read: false,
            created_at: now.toISOString(),
          });
        });
      }
    }

    // Get pending RFQs for Ops roles
    if (["EXIM Ops (operation)", "domestics Ops (operation)", "Import DTD Ops (operation)", "traffic & warehous (operation)"].includes(profile.role_name)) {
      const { data: pendingRfqs } = await supabase
        .from("tickets")
        .select("ticket_id, subject, created_at")
        .eq("ticket_type", "inquiry tariff")
        .eq("dept_target", profile.dept_code)
        .in("inquiry_status", ["OPEN", "WAITING RESPON"])
        .order("created_at", { ascending: true })
        .limit(5);

      if (pendingRfqs) {
        pendingRfqs.forEach((rfq) => {
          const createdAt = new Date(rfq.created_at);
          notifications.push({
            id: `rfq-${rfq.ticket_id}`,
            type: "ticket",
            title: "Pending RFQ",
            message: `${rfq.ticket_id}: ${rfq.subject}`,
            href: `/ticketing/${rfq.ticket_id}`,
            read: createdAt < oneDayAgo,
            created_at: rfq.created_at,
          });
        });
      }
    }

    // Sort by created_at descending
    notifications.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Filter unread only if requested
    let filtered = notifications;
    if (unreadOnly) {
      filtered = notifications.filter((n) => !n.read);
    }

    // Count unread
    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({
      notifications: filtered.slice(0, limit),
      unread_count: unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error("Error in GET /api/notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/notifications/mark-read - Mark notifications as read
export async function POST(request: NextRequest) {
  try {
    const profile = await getProfile();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { notification_ids } = body;

    // In a real implementation, you would store read status in a user_notifications table
    // For now, we just acknowledge the request
    // This is a placeholder since notifications are derived from existing data

    return NextResponse.json({
      success: true,
      marked_read: notification_ids?.length || 0,
    });
  } catch (error) {
    console.error("Error in POST /api/notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
