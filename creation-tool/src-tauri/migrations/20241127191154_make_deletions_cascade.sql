-- First, we need to drop the existing foreign key constraints by recreating the tables
-- Due to SQLite limitations, we need to do this with temporary tables

-- Handle pages table
CREATE TABLE pages_new (
    id INTEGER PRIMARY KEY,
    content TEXT NOT NULL,
    story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_start_page INTEGER DEFAULT 0
);

INSERT INTO pages_new SELECT * FROM pages;
DROP TABLE pages;
ALTER TABLE pages_new RENAME TO pages;

-- Handle choices table
CREATE TABLE choices_new (
    id INTEGER PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    target_page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
    text TEXT NOT NULL DEFAULT ''
);

INSERT INTO choices_new SELECT * FROM choices;
DROP TABLE choices;
ALTER TABLE choices_new RENAME TO choices;

-- Handle stories table
CREATE TABLE stories_new (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    start_page INTEGER REFERENCES pages(id) ON DELETE CASCADE,
    created_at TIMESTAMP
);

INSERT INTO stories_new SELECT * FROM stories;
DROP TABLE stories;
ALTER TABLE stories_new RENAME TO stories;
