"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Shield, Database, Users } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  profile_not_found: "Your account exists but no profile was found. Please contact an administrator to create your profile with your User ID (shown below).",
  auth_callback_error: "Authentication failed. Please try again.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Check for error in URL query params and fetch user ID if profile_not_found
  useEffect(() => {
    const errorCode = searchParams.get("error");
    if (errorCode && ERROR_MESSAGES[errorCode]) {
      setError(ERROR_MESSAGES[errorCode]);

      // If profile not found, try to get the current user's ID to show them
      if (errorCode === "profile_not_found") {
        const fetchUserId = async () => {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setUserId(user.id);
          }
        };
        fetchUserId();
      }
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUserId(null);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!data.session || !data.user) {
        setError("Login succeeded but no session was created. Please try again.");
        setLoading(false);
        return;
      }

      // Check if profile exists for this user
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error checking profile:", profileError);
        setError("Error checking your profile. Please try again.");
        setLoading(false);
        return;
      }

      if (!profile) {
        // No profile found - show helpful message with user ID
        setUserId(data.user.id);
        setError(ERROR_MESSAGES.profile_not_found);
        setLoading(false);
        return;
      }

      // Wait a moment for cookies to be set properly
      await new Promise(resolve => setTimeout(resolve, 100));

      // Force a hard navigation to ensure session is loaded on server
      window.location.replace("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  const features = [
    { icon: Shield, label: "Role-based Access Control", desc: "15 distinct roles with granular permissions" },
    { icon: Database, label: "Real-time Analytics", desc: "Live KPI monitoring and insights" },
    { icon: Users, label: "CRM Integration", desc: "Complete lead-to-customer pipeline" },
  ];

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-secondary to-primary" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `radial-gradient(circle at 25% 25%, white 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/30 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">UGC Logistics</h1>
              <p className="text-sm text-white/60">Integrated Dashboard</p>
            </div>
          </div>
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold tracking-tight mb-4">Your Complete<br />Business Command Center</h2>
              <p className="text-lg text-white/70 leading-relaxed max-w-lg">Monitor KPIs, manage leads, track tickets, and control receivables—all in one powerful dashboard.</p>
            </div>
            <div className="space-y-4">
              {features.map((feature, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{feature.label}</h3>
                    <p className="text-sm text-white/60">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-12 pt-8 border-t border-white/10">
            <div><p className="text-3xl font-bold">15</p><p className="text-sm text-white/60">User Roles</p></div>
            <div><p className="text-3xl font-bold">5</p><p className="text-sm text-white/60">Core Modules</p></div>
            <div><p className="text-3xl font-bold">100%</p><p className="text-sm text-white/60">RLS Secured</p></div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-background relative">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">UGC Logistics</h1>
              <p className="text-sm text-muted-foreground">Integrated Dashboard</p>
            </div>
          </div>
          <div className="card p-8 card-hover">
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
              <p className="text-muted-foreground mt-2">Sign in to access your dashboard</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-11" placeholder="name@company.com" required disabled={loading} />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-11 pr-11" placeholder="Enter your password" required disabled={loading} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                  {userId && (
                    <div className="mt-2 p-2 bg-background rounded border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Your User ID:</p>
                      <code className="text-xs font-mono text-foreground break-all select-all">{userId}</code>
                    </div>
                  )}
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full group">
                {loading ? (<><svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg><span>Signing in...</span></>) : (<><span>Sign in</span><ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" /></>)}
              </button>
            </form>
            <div className="flex items-center justify-center gap-6 mt-8 pt-6 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Shield className="h-4 w-4" /><span>SSL Encrypted</span></div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Database className="h-4 w-4" /><span>RLS Protected</span></div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-8">© 2026 UGC Logistics. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
