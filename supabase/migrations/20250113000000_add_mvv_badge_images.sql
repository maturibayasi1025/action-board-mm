-- Add image path columns to user_badges table for MVV badge images
-- Only add columns if the table exists (it may not exist if this migration runs before create_badges_system.sql)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_badges') THEN
    ALTER TABLE public.user_badges
    ADD COLUMN IF NOT EXISTS badge_image_path TEXT,
    ADD COLUMN IF NOT EXISTS icon_image_path TEXT;
  END IF;
END $$;

-- Add comments (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_badges') THEN
    COMMENT ON COLUMN public.user_badges.badge_image_path IS 
    'Path to badge image in Supabase Storage (e.g., mvv_badge_images/2025-Q3/MVV_PASSIONATE_EXECUTION/badge_1234567890.png)';
    COMMENT ON COLUMN public.user_badges.icon_image_path IS 
    'Path to icon image in Supabase Storage (e.g., mvv_badge_images/2025-Q3/MVV_PASSIONATE_EXECUTION/icon_1234567890.png)';
  END IF;
END $$;

-- Create storage bucket for MVV badge images
INSERT INTO storage.buckets (id, name)
VALUES ('mvv_badge_images', 'mvv_badge_images')
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for mvv_badge_images bucket
-- Allow anyone to read images
CREATE POLICY "Anyone can view MVV badge images"
ON storage.objects FOR SELECT
USING (bucket_id = 'mvv_badge_images');

-- Allow service role to upload/update images
CREATE POLICY "Service role can manage MVV badge images"
ON storage.objects FOR ALL
USING (bucket_id = 'mvv_badge_images' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'mvv_badge_images' AND auth.role() = 'service_role');



