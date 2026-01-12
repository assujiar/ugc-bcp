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

  // First try to get session from cookie (doesn't require API call)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Error getting session:", sessionError);
    return null;
  }

  if (!session) {
    // No session in cookie
    return null;
  }

  // Session exists, now validate with server
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error("Error validating user:", userError);
    // If validation fails but session exists, return session user as fallback
    // This handles edge cases where the auth server is temporarily unavailable
    return session.user;
  }

  return user;
}

export async function getProfile() {
  const supabase = await createServerClient();

  // Get user (uses improved logic with session fallback)
  const user = await getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) {
    console.error("Error getting profile for user:", user.id, error);
    return null;
  }

  return profile;
}

export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
}
