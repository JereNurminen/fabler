-- Add migration script here
ALTER TABLE stories
DROP COLUMN start_page;

ALTER TABLE pages
ADD COLUMN is_start_page INTEGER DEFAULT 0;
