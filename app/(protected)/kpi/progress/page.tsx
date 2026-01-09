"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@/lib/contexts/user-context";
import { fetchKpiTargets, updateKpiProgress } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Target,
  Save,
  CheckCircle,
  Calendar,
  FileEdit,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiTarget {
  id: number;
  metric_key: string;
  period_start: string;
  period_end: string;
  target_value: number;
  assignee_user_id: string | null;
  metric?: {
    metric_key: string;
    owner_role: string;
    unit: string;
    calc_method: string;
    direction: string;
    description: string;
  };
}

interface ProgressInput {
  value: string;
  notes: string;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

export default function KpiProgressPage() {
  const { user } = useUser();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [targets, setTargets] = React.useState<KpiTarget[]>([]);
  const [progressInputs, setProgressInputs] = React.useState<Record<string, ProgressInput>>({});

  // Current month period (default)
  const today = new Date();
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];

  React.useEffect(() => {
    async function loadTargets() {
      setLoading(true);
      const result = await fetchKpiTargets({
        assignee_user_id: user?.user_id || undefined,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        const targetsData = (result.data as { data: KpiTarget[] }).data || [];
        setTargets(targetsData);

        // Initialize progress inputs
        const inputs: Record<string, ProgressInput> = {};
        targetsData.forEach((target) => {
          inputs[target.metric_key] = {
            value: "",
            notes: "",
            saving: false,
            saved: false,
            error: null,
          };
        });
        setProgressInputs(inputs);
      }
      setLoading(false);
    }

    if (user?.user_id) {
      loadTargets();
    }
  }, [user?.user_id]);

  const handleValueChange = (metricKey: string, value: string) => {
    setProgressInputs((prev) => ({
      ...prev,
      [metricKey]: {
        ...prev[metricKey],
        value,
        saved: false,
        error: null,
      },
    }));
  };

  const handleNotesChange = (metricKey: string, notes: string) => {
    setProgressInputs((prev) => ({
      ...prev,
      [metricKey]: {
        ...prev[metricKey],
        notes,
        saved: false,
        error: null,
      },
    }));
  };

  const handleSave = async (target: KpiTarget) => {
    const metricKey = target.metric_key;
    const input = progressInputs[metricKey];

    if (!input?.value) {
      setProgressInputs((prev) => ({
        ...prev,
        [metricKey]: {
          ...prev[metricKey],
          error: "Please enter a value",
        },
      }));
      return;
    }

    const numValue = parseFloat(input.value);
    if (isNaN(numValue)) {
      setProgressInputs((prev) => ({
        ...prev,
        [metricKey]: {
          ...prev[metricKey],
          error: "Please enter a valid number",
        },
      }));
      return;
    }

    // Set saving state
    setProgressInputs((prev) => ({
      ...prev,
      [metricKey]: {
        ...prev[metricKey],
        saving: true,
        error: null,
      },
    }));

    const result = await updateKpiProgress({
      metric_key: metricKey,
      period_start: target.period_start || periodStart,
      period_end: target.period_end || periodEnd,
      value: numValue,
      notes: input.notes || undefined,
    });

    if (result.error) {
      setProgressInputs((prev) => ({
        ...prev,
        [metricKey]: {
          ...prev[metricKey],
          saving: false,
          error: result.error || "Failed to save",
        },
      }));
    } else {
      setProgressInputs((prev) => ({
        ...prev,
        [metricKey]: {
          ...prev[metricKey],
          saving: false,
          saved: true,
          error: null,
        },
      }));

      // Reset saved indicator after 3 seconds
      setTimeout(() => {
        setProgressInputs((prev) => ({
          ...prev,
          [metricKey]: {
            ...prev[metricKey],
            saved: false,
          },
        }));
      }, 3000);
    }
  };

  const formatMetricName = (key: string) => {
    return key
      .replace(/_/g, " ")
      .replace(/^(SALES|MKT|MARCOMM|DGO|MACX|VSDO)\s/i, "")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Filter to show only MANUAL metrics for progress input
  const manualTargets = targets.filter(
    (t) => t.metric?.calc_method === "MANUAL" || t.metric?.calc_method === "IMPORTED"
  );

  const autoTargets = targets.filter(
    (t) => t.metric?.calc_method === "AUTO"
  );

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <Link
          href="/kpi"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to KPI Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Update KPI Progress</h1>
            <p className="text-muted-foreground">Input your actual progress for manual KPI metrics</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Period: {periodStart} to {periodEnd}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-[14px] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading KPI targets...</span>
        </div>
      ) : targets.length === 0 ? (
        <div className="card text-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium text-foreground mb-1">No KPI Targets Assigned</p>
          <p className="text-sm text-muted-foreground">
            Contact your manager to set KPI targets for you
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Manual Metrics Section */}
          {manualTargets.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileEdit className="h-5 w-5 text-warning" />
                Manual Input Required
              </h2>
              <div className="space-y-4">
                {manualTargets.map((target) => {
                  const input = progressInputs[target.metric_key] || { value: "", notes: "", saving: false, saved: false, error: null };

                  return (
                    <div key={target.id} className="card">
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Target className="h-5 w-5 text-muted-foreground" />
                            <h3 className="font-semibold text-foreground">
                              {formatMetricName(target.metric_key)}
                            </h3>
                            <span className="badge badge-warning text-xs">
                              {target.metric?.calc_method}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {target.metric?.description || "No description"}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                            <span>
                              Target: <strong className="text-foreground">{target.target_value.toLocaleString()}</strong> {target.metric?.unit}
                            </span>
                            <span className="text-border">•</span>
                            <span>
                              {new Date(target.period_start).toLocaleDateString("id-ID")} - {new Date(target.period_end).toLocaleDateString("id-ID")}
                            </span>
                          </div>

                          {/* Input Fields */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1">
                                Actual Value <span className="text-destructive">*</span>
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={input.value}
                                  onChange={(e) => handleValueChange(target.metric_key, e.target.value)}
                                  className={cn("input flex-1", input.error && "border-destructive")}
                                  placeholder="Enter actual value"
                                />
                                <span className="text-sm text-muted-foreground">{target.metric?.unit}</span>
                              </div>
                              {input.error && (
                                <p className="text-xs text-destructive mt-1">{input.error}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1">
                                Notes (optional)
                              </label>
                              <input
                                type="text"
                                value={input.notes}
                                onChange={(e) => handleNotesChange(target.metric_key, e.target.value)}
                                className="input w-full"
                                placeholder="Add notes..."
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSave(target)}
                            disabled={input.saving}
                            className="btn-primary"
                          >
                            {input.saving ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                Saving...
                              </>
                            ) : input.saved ? (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1 text-success" />
                                Saved
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-1" />
                                Save
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Auto Metrics Section (Read Only) */}
          {autoTargets.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-info" />
                Auto-Calculated Metrics
                <span className="text-sm font-normal text-muted-foreground">(Read Only)</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {autoTargets.map((target) => (
                  <div key={target.id} className="card-compact">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-foreground">
                        {formatMetricName(target.metric_key)}
                      </h3>
                      <span className="badge badge-info text-xs">AUTO</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Target: {target.target_value.toLocaleString()} {target.metric?.unit}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Auto-calculated from system data
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
