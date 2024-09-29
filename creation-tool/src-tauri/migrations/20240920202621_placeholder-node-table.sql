CREATE TABLE IF NOT EXISTS story_nodes (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    next_node INTEGER
);
