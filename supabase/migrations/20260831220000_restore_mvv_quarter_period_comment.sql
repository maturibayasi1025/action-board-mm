-- Restore MVV quarter_period comment to the intended cycle
-- Q1: Mar-May, Q2: Jun-Aug, Q3: Sep-Nov, Q4: Dec-Feb (fiscal year starts in March)

COMMENT ON COLUMN public.user_badges.quarter_period IS
'Quarter period for MVV badges in format YYYY-QN (e.g., 2024-Q1).
Q1: Mar-May, Q2: Jun-Aug, Q3: Sep-Nov, Q4: Dec-Feb (fiscal year starts in March).
Only used for MVV badge types, NULL for other badge types.';
