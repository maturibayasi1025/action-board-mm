-- Add MVV_START_DASH badge type to user_badges table
-- Only modify if the table exists (it may not exist if this migration runs before create_badges_system.sql)

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_badges') THEN
    -- First, drop the existing CHECK constraint
    ALTER TABLE public.user_badges
    DROP CONSTRAINT IF EXISTS user_badges_badge_type_check;

    -- Add the new CHECK constraint with MVV_START_DASH badge type
    ALTER TABLE public.user_badges
    ADD CONSTRAINT user_badges_badge_type_check
    CHECK (badge_type IN (
      'DAILY',
      'ALL',
      'PREFECTURE',
      'MISSION',
      'MVV_PASSIONATE_EXECUTION',
      'MVV_SUPREME_RELATIONSHIPS',
      'MVV_HAPPINESS_CIRCULATION',
      'MVV_START_DASH'
    ));

    -- Update badge_type column comment
    COMMENT ON COLUMN public.user_badges.badge_type IS 
    'Type of badge: DAILY, ALL, PREFECTURE, MISSION, MVV_PASSIONATE_EXECUTION, MVV_SUPREME_RELATIONSHIPS, MVV_HAPPINESS_CIRCULATION, or MVV_START_DASH';
  END IF;
END $$;

