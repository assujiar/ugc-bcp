"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { createLead, checkLeadDuplicate, DedupMatch } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Truck,
  Calendar,
  MessageSquare,
  FileText,
  AlertTriangle,
  X,
} from "lucide-react";
import Link from "next/link";

const PRIMARY_CHANNELS = [
  "LinkedIn",
  "SEM",
  "Paid Social",
  "Website (Direct/Referral)",
  "Webinar & Live",
  "Event Offline",
  "Trade Show",
  "Partnership/Referral",
  "Sales Outbound",
  "Sales Referral",
  "Other",
];

const SERVICES = [
  { code: "DOM_LTL", name: "Domestics - LTL", dept: "DOM" },
  { code: "DOM_FTL", name: "Domestics - FTL (Charter)", dept: "DOM" },
  { code: "DOM_LCL", name: "Domestics - LCL", dept: "DOM" },
  { code: "DOM_FCL", name: "Domestics - FCL", dept: "DOM" },
  { code: "DOM_AF", name: "Domestics - Air Freight", dept: "DOM" },
  { code: "DOM_WHF", name: "Domestics - Warehouse & Fulfillment", dept: "DOM" },
  { code: "EXI_LCL_EXPORT", name: "EXIM - LCL Export", dept: "EXI" },
  { code: "EXI_LCL_IMPORT", name: "EXIM - LCL Import", dept: "EXI" },
  { code: "EXI_FCL_EXPORT", name: "EXIM - FCL Export", dept: "EXI" },
  { code: "EXI_FCL_IMPORT", name: "EXIM - FCL Import", dept: "EXI" },
  { code: "EXI_AF", name: "EXIM - Air Freight", dept: "EXI" },
  { code: "EXI_CUSTOMS", name: "EXIM - Customs Clearance", dept: "EXI" },
  { code: "DTD_LCL", name: "Import DTD - LCL", dept: "DTD" },
  { code: "DTD_FCL", name: "Import DTD - FCL", dept: "DTD" },
  { code: "DTD_AF", name: "Import DTD - Air Freight", dept: "DTD" },
  { code: "TRF_WHF", name: "Warehouse & Fulfillment", dept: "TRF" },
];

const NEXT_STEPS = ["Call", "Email", "Visit", "Online Meeting", "Send Proposal", "Follow Up"];

const TIMELINES = ["Immediate", "1-2 Weeks", "1 Month", "2-3 Months", "3+ Months", "Unknown"];

export default function NewLeadPage() {
  const router = useRouter();
  const { user, isMarketing, isSales } = useUser();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Dedup check state
  const [checkingDedup, setCheckingDedup] = React.useState(false);
  const [dedupMatches, setDedupMatches] = React.useState<DedupMatch[]>([]);
  const [showDedupModal, setShowDedupModal] = React.useState(false);
  const [forceCreate, setForceCreate] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    // Company Info
    company_name: "",
    pic_name: "",
    contact_phone: "",
    email: "",
    city_area: "",
    npwp: "",
    // Service
    service_code: "",
    route: "",
    est_volume_value: "",
    est_volume_unit: "kg",
    timeline: "1 Month",
    // Attribution
    primary_channel: isMarketing ? "LinkedIn" : "Sales Outbound",
    campaign_name: "",
    notes: "",
    // Follow-up
    next_step: "Call",
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    // RFQ Toggle
    need_rfq: false,
    // RFQ Fields
    origin_address: "",
    origin_city: "",
    origin_country: "Indonesia",
    destination_address: "",
    destination_city: "",
    destination_country: "Indonesia",
    cargo_category: "",
    cargo_qty: "",
    cargo_dimensions: "",
    cargo_weight: "",
    scope_of_work: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  // Check for duplicates before submitting
  const checkDuplicates = async (): Promise<boolean> => {
    if (!formData.email && !formData.contact_phone) {
      return true; // No email/phone to check
    }

    setCheckingDedup(true);
    try {
      const result = await checkLeadDuplicate(
        formData.email || undefined,
        formData.contact_phone || undefined
      );

      if (result.error) {
        console.error("Error checking duplicates:", result.error);
        return true; // Proceed if check fails
      }

      if (result.data?.exists && result.data.matches.length > 0) {
        setDedupMatches(result.data.matches);
        setShowDedupModal(true);
        return false; // Stop submission, show modal
      }

      return true; // No duplicates, proceed
    } catch (err) {
      console.error("Error checking duplicates:", err);
      return true; // Proceed if check fails
    } finally {
      setCheckingDedup(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate required fields
    if (!formData.company_name || !formData.pic_name || !formData.contact_phone || !formData.email) {
      setError("Please fill in all required company information");
      setLoading(false);
      return;
    }

    if (!formData.service_code || !formData.city_area) {
      setError("Please select a service and enter city/area");
      setLoading(false);
      return;
    }

    // Validate RFQ fields if enabled
    if (formData.need_rfq) {
      if (!formData.origin_city || !formData.destination_city || !formData.cargo_category) {
        setError("Please fill in RFQ required fields (origin, destination, cargo category)");
        setLoading(false);
        return;
      }
    }

    // Check for duplicates (unless force create is enabled)
    if (!forceCreate) {
      const canProceed = await checkDuplicates();
      if (!canProceed) {
        setLoading(false);
        return;
      }
    }

    // Reset force create flag
    setForceCreate(false);

    // Get dept_target from service
    const service = SERVICES.find((s) => s.code === formData.service_code);
    const dept_target = service?.dept || "DOM";

    const result = await createLead({
      company_name: formData.company_name,
      pic_name: formData.pic_name,
      contact_phone: formData.contact_phone,
      email: formData.email,
      city_area: formData.city_area,
      npwp: formData.npwp || undefined,
      service_code: formData.service_code,
      route: formData.route || undefined,
      est_volume_value: formData.est_volume_value ? parseFloat(formData.est_volume_value) : undefined,
      est_volume_unit: formData.est_volume_unit || undefined,
      timeline: formData.timeline || undefined,
      sourced_by: isMarketing ? "Marketing" : "Sales",
      primary_channel: formData.primary_channel,
      campaign_name: formData.campaign_name || undefined,
      notes: formData.notes || undefined,
      next_step: formData.next_step,
      due_date: formData.due_date,
      need_rfq: formData.need_rfq,
      dept_target: dept_target,
      origin_address: formData.origin_address || undefined,
      origin_city: formData.origin_city || undefined,
      origin_country: formData.origin_country || undefined,
      destination_address: formData.destination_address || undefined,
      destination_city: formData.destination_city || undefined,
      destination_country: formData.destination_country || undefined,
      cargo_category: formData.cargo_category || undefined,
      cargo_qty: formData.cargo_qty ? parseFloat(formData.cargo_qty) : undefined,
      cargo_dimensions: formData.cargo_dimensions || undefined,
      cargo_weight: formData.cargo_weight ? parseFloat(formData.cargo_weight) : undefined,
      scope_of_work: formData.scope_of_work || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push("/crm/leads");
      }, 1500);
    }
  };

  // Handle force create after user confirms
  const handleForceCreate = () => {
    setShowDedupModal(false);
    setForceCreate(true);
    // Trigger form submit programmatically
    const form = document.querySelector("form");
    if (form) {
      form.requestSubmit();
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CheckCircle className="h-16 w-16 text-success mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Lead Created Successfully!</h2>
        <p className="text-muted-foreground">Redirecting to leads list...</p>
      </div>
    );
  }

  return (
    <>
      {/* Duplicate Warning Modal */}
      {showDedupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-[14px] shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-warning/10">
                  <AlertTriangle className="h-6 w-6 text-warning" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Possible Duplicate Found</h2>
              </div>
              <button
                onClick={() => setShowDedupModal(false)}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <p className="text-sm text-muted-foreground mb-4">
                We found {dedupMatches.length} existing record(s) that match the email or phone number you entered.
                Please review the matches below:
              </p>
              <div className="space-y-3">
                {dedupMatches.map((match, index) => (
                  <div key={`${match.type}-${match.id}-${index}`} className="p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`badge text-xs ${match.type === "lead" ? "badge-info" : "badge-success"}`}>
                        {match.type === "lead" ? "Lead" : "Customer"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Matched by: {match.match_field}
                      </span>
                      {match.status && (
                        <span className="text-xs text-muted-foreground">
                          Status: {match.status}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-foreground">{match.company_name}</p>
                    <p className="text-sm text-muted-foreground">{match.pic_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {match.email && <span className="mr-2">{match.email}</span>}
                      {match.phone && <span>{match.phone}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-border flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDedupModal(false)}
                className="btn-outline"
              >
                Cancel & Edit
              </button>
              <button
                onClick={handleForceCreate}
                className="btn-primary"
              >
                Create Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-6">
        <Link
          href="/crm/leads"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leads
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Create New Lead</h1>
        <p className="text-muted-foreground">
          Add a new lead to your pipeline. Customer and prospect will be auto-created.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Information */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Company Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Company Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                className="input w-full"
                placeholder="PT Example Company"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">NPWP</label>
              <input
                type="text"
                name="npwp"
                value={formData.npwp}
                onChange={handleChange}
                className="input w-full"
                placeholder="00.000.000.0-000.000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                PIC Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="pic_name"
                value={formData.pic_name}
                onChange={handleChange}
                className="input w-full"
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Phone <span className="text-destructive">*</span>
              </label>
              <input
                type="tel"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
                className="input w-full"
                placeholder="08123456789"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="input w-full"
                placeholder="john@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                City/Area <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="city_area"
                value={formData.city_area}
                onChange={handleChange}
                className="input w-full"
                placeholder="Jakarta"
                required
              />
            </div>
          </div>
        </div>

        {/* Service Requirements */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            Service Requirements
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Service <span className="text-destructive">*</span>
              </label>
              <select
                name="service_code"
                value={formData.service_code}
                onChange={handleChange}
                className="input w-full"
                required
              >
                <option value="">Select Service</option>
                {SERVICES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Route</label>
              <input
                type="text"
                name="route"
                value={formData.route}
                onChange={handleChange}
                className="input w-full"
                placeholder="Jakarta → Surabaya"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Est. Volume
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="est_volume_value"
                  value={formData.est_volume_value}
                  onChange={handleChange}
                  className="input flex-1"
                  placeholder="100"
                />
                <select
                  name="est_volume_unit"
                  value={formData.est_volume_unit}
                  onChange={handleChange}
                  className="input w-24"
                >
                  <option value="kg">kg</option>
                  <option value="cbm">cbm</option>
                  <option value="TEU">TEU</option>
                  <option value="shipment">shipment</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Timeline</label>
              <select
                name="timeline"
                value={formData.timeline}
                onChange={handleChange}
                className="input w-full"
              >
                {TIMELINES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Attribution */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            Attribution & Notes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Primary Channel <span className="text-destructive">*</span>
              </label>
              <select
                name="primary_channel"
                value={formData.primary_channel}
                onChange={handleChange}
                className="input w-full"
                required
              >
                {PRIMARY_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Campaign Name
              </label>
              <input
                type="text"
                name="campaign_name"
                value={formData.campaign_name}
                onChange={handleChange}
                className="input w-full"
                placeholder="Q1 2025 LinkedIn Ads"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="input w-full"
                rows={3}
                placeholder="Additional notes about this lead..."
              />
            </div>
          </div>
        </div>

        {/* Follow-up */}
        <div className="card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Follow-up Action
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Next Step <span className="text-destructive">*</span>
              </label>
              <select
                name="next_step"
                value={formData.next_step}
                onChange={handleChange}
                className="input w-full"
                required
              >
                {NEXT_STEPS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Due Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                className="input w-full"
                required
              />
            </div>
          </div>
        </div>

        {/* RFQ Toggle */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Request for Quote (RFQ)</h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="need_rfq"
                checked={formData.need_rfq}
                onChange={handleChange}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">Create RFQ Ticket</span>
            </label>
          </div>

          {formData.need_rfq && (
            <div className="space-y-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                An inquiry tariff ticket will be auto-created and assigned to the operations team.
                Customer info will be masked for Ops.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Origin City <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    name="origin_city"
                    value={formData.origin_city}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Jakarta"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Destination City <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    name="destination_city"
                    value={formData.destination_city}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Surabaya"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Origin Address
                  </label>
                  <input
                    type="text"
                    name="origin_address"
                    value={formData.origin_address}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Jl. Example No. 123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Destination Address
                  </label>
                  <input
                    type="text"
                    name="destination_address"
                    value={formData.destination_address}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Jl. Example No. 456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Cargo Category <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    name="cargo_category"
                    value={formData.cargo_category}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="General Cargo, Electronics, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Cargo Quantity
                  </label>
                  <input
                    type="number"
                    name="cargo_qty"
                    value={formData.cargo_qty}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Cargo Weight (kg)
                  </label>
                  <input
                    type="number"
                    name="cargo_weight"
                    value={formData.cargo_weight}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Dimensions (LxWxH cm)
                  </label>
                  <input
                    type="text"
                    name="cargo_dimensions"
                    value={formData.cargo_dimensions}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="100x50x50"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Scope of Work
                  </label>
                  <textarea
                    name="scope_of_work"
                    value={formData.scope_of_work}
                    onChange={handleChange}
                    className="input w-full"
                    rows={3}
                    placeholder="Door-to-door, include customs clearance, etc."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/crm/leads" className="btn-outline">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={loading || checkingDedup}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : checkingDedup ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Checking...
              </>
            ) : (
              "Create Lead"
            )}
          </button>
        </div>
      </form>
    </>
  );
}
