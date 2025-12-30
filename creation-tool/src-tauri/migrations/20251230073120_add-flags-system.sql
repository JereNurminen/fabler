-- Add flags system for conditional choices and dynamic story elements

-- Flags table: Boolean flags defined at story level
CREATE TABLE IF NOT EXISTS flags (
    id INTEGER PRIMARY KEY,
    story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    default_value INTEGER NOT NULL DEFAULT 0,  -- 0 = false, 1 = true
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(story_id, name)  -- Flag names must be unique within a story
);

-- Choice flag operations: Flags set when a choice is selected
CREATE TABLE IF NOT EXISTS choice_flag_operations (
    id INTEGER PRIMARY KEY,
    choice_id INTEGER NOT NULL REFERENCES choices(id) ON DELETE CASCADE,
    flag_id INTEGER NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,  -- 'set_true', 'set_false', 'toggle'
    UNIQUE(choice_id, flag_id)  -- One operation per flag per choice
);

-- Page flag operations: Flags set when a page is shown
CREATE TABLE IF NOT EXISTS page_flag_operations (
    id INTEGER PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    flag_id INTEGER NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,  -- 'set_true', 'set_false', 'toggle'
    UNIQUE(page_id, flag_id)  -- One operation per flag per page
);

-- Choice conditions: Requirements for showing choices
CREATE TABLE IF NOT EXISTS choice_conditions (
    id INTEGER PRIMARY KEY,
    choice_id INTEGER NOT NULL REFERENCES choices(id) ON DELETE CASCADE,
    flag_id INTEGER NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
    required_value INTEGER NOT NULL,  -- 0 = must be false, 1 = must be true
    UNIQUE(choice_id, flag_id)  -- One condition per flag per choice
);
