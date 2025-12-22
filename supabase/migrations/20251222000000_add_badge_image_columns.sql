-- Add badge_image_path and icon_image_path columns to user_badges table
-- These columns were supposed to be added in 20250113000000_add_mvv_badge_images.sql
-- but may not have been added if the table didn't exist at that time

ALTER TABLE public.user_badges
ADD COLUMN IF NOT EXISTS badge_image_path TEXT,
ADD COLUMN IF NOT EXISTS icon_image_path TEXT;

-- Add comments
COMMENT ON COLUMN public.user_badges.badge_image_path IS 
'Path to badge image in Supabase Storage (e.g., mvv_badge_images/2025-Q3/MVV_PASSIONATE_EXECUTION/badge_1234567890.png)';

COMMENT ON COLUMN public.user_badges.icon_image_path IS 
'Path to icon image in Supabase Storage (e.g., mvv_badge_images/2025-Q3/MVV_PASSIONATE_EXECUTION/icon_1234567890.png)';

