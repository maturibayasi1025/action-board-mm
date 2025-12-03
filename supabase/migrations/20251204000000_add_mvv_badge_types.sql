-- Add MVV badge types and quarter_period column to user_badges table

-- First, drop the existing CHECK constraint
ALTER TABLE public.user_badges
DROP CONSTRAINT IF EXISTS user_badges_badge_type_check;

-- Add the new CHECK constraint with MVV badge types
ALTER TABLE public.user_badges
ADD CONSTRAINT user_badges_badge_type_check
CHECK (badge_type IN (
  'DAILY',
  'ALL',
  'PREFECTURE',
  'MISSION',
  'MVV_PASSIONATE_EXECUTION',
  'MVV_SUPREME_RELATIONSHIPS',
  'MVV_HAPPINESS_CIRCULATION'
));

-- Add quarter_period column (nullable, used only for MVV badges)
ALTER TABLE public.user_badges
ADD COLUMN IF NOT EXISTS quarter_period TEXT;

-- Add index for quarter_period queries
CREATE INDEX IF NOT EXISTS idx_user_badges_quarter_period 
ON public.user_badges(quarter_period) 
WHERE quarter_period IS NOT NULL;

-- Add comment for quarter_period column
COMMENT ON COLUMN public.user_badges.quarter_period IS 
'Quarter period for MVV badges in format YYYY-QN (e.g., 2024-Q1). 
Q1: Mar-May, Q2: Jun-Aug, Q3: Sep-Nov, Q4: Dec-Feb (fiscal year starts in March).
Only used for MVV badge types, NULL for other badge types.';

-- Update table comment
COMMENT ON TABLE public.user_badges IS 
'Stores user achievement badges based on rankings and MVV values (manual awards)';

-- Update badge_type column comment
COMMENT ON COLUMN public.user_badges.badge_type IS 
'Type of badge: DAILY, ALL, PREFECTURE, MISSION, MVV_PASSIONATE_EXECUTION, MVV_SUPREME_RELATIONSHIPS, or MVV_HAPPINESS_CIRCULATION';

