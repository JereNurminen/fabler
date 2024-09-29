-- Add migration script here
ALTER TABLE stories ADD COLUMN start_page INTEGER REFERENCES pages(id);

ALTER TABLE stories ADD COLUMN created_at TIMESTAMP;
UPDATE stories SET created_at = CURRENT_TIMESTAMP;
