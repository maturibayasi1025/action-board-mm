-- Drop poster map related tables (feature removed)
DROP VIEW IF EXISTS user_edited_boards;
DROP TABLE IF EXISTS poster_activities CASCADE;
DROP TABLE IF EXISTS poster_boards CASCADE;
DROP TABLE IF EXISTS poster_data_staging CASCADE;
DROP TABLE IF EXISTS posting_shapes CASCADE;

DROP FUNCTION IF EXISTS get_poster_board_stats_optimized();
