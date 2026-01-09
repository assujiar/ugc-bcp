"use client";

import * as React from "react";
import Link from "next/link";
import {
  Target,
  Users,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Upload,
  FileEdit,
  BarChart3,
  ChevronDown,
  Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface KpiMetric {
  metric_key: string;
  owner_role: string;
  unit: string | null;
  calc_method: string;
  direction: string;
  description: string | null;
}

interface KpiTarget {
  id: number;
  metric_key: string;
  period_start: string;
  period_end: string;
  target_value: number;
  assignee_user_id: string | null;
}

interface KpiSummary {
  totalKpis: number;
  onTrack: number;
  atRisk: number;
  behind: number;
}

const categoryFilters = [
  { id: "all", label: "All" },
  { id: "sales", label: "Sales" },
  { id: "sales_activity", label: "Sales Activity" },
  { id: "marketing", label: "Marketing" },
  { id: "marcomm", label: "Marcomm" },
  { id: "dgo", label: "DGO" },
  { id: "vsdo", label: "VSDO" },
];

export default function KpiPage() {
  const [metrics, setMetrics] = React.useState<KpiMetric[]>([]);
  const [targets, setTargets] = React.useState<KpiTarget[]>([]);
  const [summary, setSummary] = React.useState<KpiSummary>({
    totalKpis: 0,
    onTrack: 0,
    atRisk: 0,
    behind: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [activeCategory, setActiveCategory] = React.useState("all");
  const [periodFilter, setPeriodFilter] = React.useState("30");

  React.useEffect(() => {
    async function fetchKpiData() {
      const supabase = createClient();

      try {
        // Fetch KPI metric definitions
        const { data: metricsData, error: metricsError } = await supabase
          .from("kpi_metric_definitions")
          .select("*")
          .order("metric_key");

        if (metricsError) throw metricsError;

        // Fetch KPI targets
        const { data: targetsData, error: targetsError } = await supabase
          .from("kpi_targets")
          .select("*")
          .order("period_start", { ascending: false });

        if (targetsError) throw targetsError;

        const typedMetrics = (metricsData || []) as KpiMetric[];
        const typedTargets = (targetsData || []) as KpiTarget[];

        setMetrics(typedMetrics);
        setTargets(typedTargets);

        // Calculate summary (for now, all are "on track" since no actual values yet)
        setSummary({
          totalKpis: typedMetrics.length,
          onTrack: 0,
          atRisk: 0,
          behind: 0,
        });
      } catch (error) {
        console.error("Error fetching KPI data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchKpiData();
  }, []);

  const filteredMetrics = React.useMemo(() => {
    if (activeCategory === "all") return metrics;

    return metrics.filter((m) => {
      const key = m.metric_key.toLowerCase();
      const role = m.owner_role.toLowerCase();

      switch (activeCategory) {
        case "sales":
          return key.startsWith("sales_") && !key.includes("activity");
        case "sales_activity":
          return key.startsWith("sales_activity");
        case "marketing":
          return key.startsWith("mkt_") || role.includes("marketing manager");
        case "marcomm":
          return key.startsWith("marcomm_") || role.includes("marcomm");
        case "dgo":
          return key.startsWith("dgo_") || role.includes("dgo");
        case "vsdo":
          return key.startsWith("vsdo_") || role.includes("vsdo");
        default:
          return true;
      }
    });
  }, [metrics, activeCategory]);

  const formatMetricName = (key: string) => {
    return key
      .replace(/_/g, " ")
      .replace(/^(SALES|MKT|MARCOMM|DGO|MACX|VSDO)\s/i, "")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">KPI Dashboard</h1>
          <p className="text-muted-foreground">Track performance against targets</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/kpi/progress" className="btn-outline">
            <Edit3 className="h-4 w-4" />
            Update Progress
          </Link>
          <Link href="/kpi/input" className="btn-outline">
            <FileEdit className="h-4 w-4" />
            Manual Input
          </Link>
          <Link href="/kpi/imports" className="btn-outline">
            <Upload className="h-4 w-4" />
            Import
          </Link>
          <Link href="/kpi/targets" className="btn-primary">
            <Target className="h-4 w-4" />
            Set Targets
          </Link>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/kpi/my" className="card-hover flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">My KPI</p>
            <p className="text-sm text-muted-foreground">Personal progress</p>
          </div>
        </Link>
        <Link href="/kpi/team" className="card-hover flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
            <Users className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <p className="font-medium text-foreground">Team KPI</p>
            <p className="text-sm text-muted-foreground">Team performance</p>
          </div>
        </Link>
        <Link href="/kpi/targets" className="card-hover flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
            <BarChart3 className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="font-medium text-foreground">Targets</p>
            <p className="text-sm text-muted-foreground">Manage targets</p>
          </div>
        </Link>
        <Link href="/kpi/imports" className="card-hover flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10">
            <Upload className="h-6 w-6 text-info" />
          </div>
          <div>
            <p className="font-medium text-foreground">Imports</p>
            <p className="text-sm text-muted-foreground">Bulk data upload</p>
          </div>
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-compact flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{summary.totalKpis}</p>
            <p className="text-sm text-muted-foreground">Total KPIs</p>
          </div>
        </div>
        <div className="card-compact flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
            <CheckCircle className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-success">{summary.onTrack}</p>
            <p className="text-sm text-muted-foreground">On Track (≥80%)</p>
          </div>
        </div>
        <div className="card-compact flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
            <AlertCircle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-warning">{summary.atRisk}</p>
            <p className="text-sm text-muted-foreground">At Risk (60-80%)</p>
          </div>
        </div>
        <div className="card-compact flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
            <TrendingDown className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-destructive">{summary.behind}</p>
            <p className="text-sm text-muted-foreground">Behind (&lt;60%)</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Category:</span>
          {categoryFilters.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeCategory === cat.id
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Period:</span>
          <div className="relative">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="input pr-8 appearance-none cursor-pointer"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      {filteredMetrics.length === 0 ? (
        <div className="card text-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No KPI Metrics Found</h3>
          <p className="text-muted-foreground mb-4">
            {activeCategory === "all"
              ? "No KPI metrics have been defined yet."
              : `No metrics found for category: ${activeCategory}`}
          </p>
          <Link href="/kpi/targets" className="btn-primary inline-flex">
            <Target className="h-4 w-4" />
            Set Up Targets
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMetrics.map((metric) => {
            const target = targets.find((t) => t.metric_key === metric.metric_key);
            const hasTarget = !!target;
            const isAuto = metric.calc_method === "AUTO";

            return (
              <div key={metric.metric_key} className="card">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-medium text-foreground">
                    {formatMetricName(metric.metric_key)}
                  </h4>
                  <span
                    className={cn(
                      "badge text-xs",
                      isAuto ? "badge-info" : "badge-warning"
                    )}
                  >
                    {metric.calc_method}
                  </span>
                </div>

                {/* Value - show placeholder since no real data yet */}
                <p className="text-3xl font-bold text-foreground mb-2">
                  {metric.unit === "IDR" ? "Rp 0" : metric.unit === "%" ? "0%" : "0"}
                </p>

                {/* Target */}
                {hasTarget ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Target: {target.target_value.toLocaleString()} {metric.unit}
                      </span>
                      <span className="text-muted-foreground">0%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-muted-foreground"
                        style={{ width: "0%" }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No target set</p>
                )}

                {/* Trend */}
                <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  No previous data
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
