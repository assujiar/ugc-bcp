import { createServerClient, createAdminClient } from "./server";

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

  // First, try to find profile by user_id
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (profile) {
    return profile;
  }

  // If no profile found by user_id, try to find an unlinked profile
  // and auto-link it to this authenticated user.
  // This handles the case where seed data has placeholder user_ids.
  if (error?.code === "PGRST116") { // No rows returned
    try {
      // Use admin client to bypass RLS for this operation
      const adminClient = createAdminClient();

      // Find the first super admin profile that might be unlinked
      const { data: unlinkedProfile } = await adminClient
        .from("profiles")
        .select("*")
        .eq("role_name", "super admin")
        .limit(1)
        .single();

      if (unlinkedProfile) {
        // Update the profile to link it to the current authenticated user
        const { data: linkedProfile, error: updateError } = await adminClient
          .from("profiles")
          .update({ user_id: user.id })
          .eq("user_id", unlinkedProfile.user_id)
          .select()
          .single();

        if (linkedProfile && !updateError) {
          console.log(`Auto-linked profile ${linkedProfile.user_code} to auth user ${user.id}`);
          return linkedProfile;
        }
      }
    } catch (adminError) {
      // Service role key not set - fall through to return null
      console.error("Could not auto-link profile (SUPABASE_SERVICE_ROLE_KEY may not be set):", adminError);
    }
  }

  if (error) {
    console.error("Error getting profile:", error);
  }

  return null;
}

export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
}
