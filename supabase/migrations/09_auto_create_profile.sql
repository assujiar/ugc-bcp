-- ============================================================================
-- UGC Integrated Dashboard – Auto-Create Profile Trigger
-- File: 09_auto_create_profile.sql
-- Purpose: Automatically create a profile when a new user signs up
-- ============================================================================

-- Function to auto-create profile for new auth users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (user_id, full_name, email, role_name, dept_code, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'super admin',  -- Default role for new users - admin should change this
    'DIR',          -- Default department
    true
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Create trigger on auth.users (only if it doesn't exist)
-- Note: This requires the function to be owned by a superuser or have proper grants
do $$
begin
  -- Drop existing trigger if exists
  drop trigger if exists on_auth_user_created on auth.users;

  -- Create new trigger
  create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();
exception
  when others then
    -- If we can't create trigger on auth.users (permissions), log and continue
    raise notice 'Could not create trigger on auth.users: %. Manual profile creation may be required.', SQLERRM;
end $$;

-- Also create profiles for existing auth users who don't have one
-- This handles existing users like superadmin@ugc.test
insert into public.profiles (user_id, full_name, email, role_name, dept_code, is_active)
select
  au.id,
  coalesce(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  au.email,
  'super admin',
  'DIR',
  true
from auth.users au
left join public.profiles p on p.user_id = au.id
where p.user_id is null
on conflict (user_id) do nothing;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
