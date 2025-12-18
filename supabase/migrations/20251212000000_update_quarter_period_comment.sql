-- Update quarter_period column comment to reflect correct quarter definitions
-- Q1: Apr-Jun, Q2: Jul-Aug, Q3: Sep-Nov, Q4: Dec-Feb (fiscal year starts in April)

COMMENT ON COLUMN public.user_badges.quarter_period IS 
'Quarter period for MVV badges in format YYYY-QN (e.g., 2024-Q1). 
Q1: Apr-Jun, Q2: Jul-Aug, Q3: Sep-Nov, Q4: Dec-Feb (fiscal year starts in April).
Only used for MVV badge types, NULL for other badge types.';

