import { createServerClient } from "./server";

export async function getSession() {
  const supabase = await createServerClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Error getting session:", error);
    return null;
  }
  return session;
}

export async function getUser() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error getting user:", error);
    return null;
  }
  return user;
}

export async function getProfile() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Use maybeSingle() to handle 0 rows gracefully (returns null, not error)
  // This helps distinguish between "no profile found" vs actual errors
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error getting profile for user:", user.id, "Error:", error.message, error.code);
    return null;
  }

  if (!profile) {
    console.warn("No profile found for authenticated user:", user.id, "email:", user.email);
  }

  return profile;
}

export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
}
