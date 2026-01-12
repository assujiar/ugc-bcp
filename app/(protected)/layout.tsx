import { redirect } from "next/navigation";
import { getProfile, getUser } from "@/lib/supabase/auth";
import { UserProvider } from "@/lib/contexts/user-context";
import { ProtectedShell } from "@/components/layout/protected-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // First check if user is authenticated
  const user = await getUser();

  if (!user) {
    // User is not authenticated, redirect to login
    redirect("/login");
  }

  // User is authenticated, get their profile
  const profile = await getProfile();

  if (!profile) {
    // User is authenticated but has no profile in the database
    // This can happen if the user was created in auth but not in profiles table
    // Redirect to login with error message
    redirect("/login?error=profile_not_found");
  }

  return (
    <UserProvider initialUser={profile}>
      <ProtectedShell>{children}</ProtectedShell>
    </UserProvider>
  );
}
