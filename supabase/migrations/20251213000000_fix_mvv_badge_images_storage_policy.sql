-- Fix storage policy for mvv_badge_images bucket
-- Service role client bypasses RLS, so we need to remove the restrictive policy
-- and allow service role to manage images directly

-- Drop the existing policy that checks auth.role()
DROP POLICY IF EXISTS "Service role can manage MVV badge images" ON storage.objects;

-- Service role client bypasses RLS, so no policy is needed for INSERT/UPDATE/DELETE
-- The SELECT policy remains for public access to images

