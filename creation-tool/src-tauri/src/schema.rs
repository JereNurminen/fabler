/// Generates a TOML schema template with documentation
pub fn generate_toml_schema() -> String {
    r#"# TOML Story Format Schema
# This file documents the structure for exported stories

[story]
# Story ID (required, number)
id = 1

# The story title (required)
title = "My Adventure Story"

# The ID of the starting page (required, number)
# Must match one of the page IDs defined below
start_page = 1

# Array of pages in the story
[[pages]]
# Page ID (required, number)
# Unique identifier for this page
id = 1

# Page name/title (required)
# Descriptive name for the page
name = "Dark Room"

# Page content/narrative (required)
# Use triple quotes for multi-line content
content = """
You wake up in a dark room.
The air is musty and cold.
What do you do?
"""

  # Array of choices available on this page (optional)
  [[pages.choices]]
  # Choice ID (required, number)
  id = 1

  # Choice text displayed to the player (required)
  text = "Open the door"

  # Target page ID this choice leads to (required, number)
  # Must match a page ID defined in this file
  target = 2

  [[pages.choices]]
  id = 2
  text = "Search the room"
  target = 3

# Additional pages follow the same structure
[[pages]]
id = 2
name = "Hallway"
content = "You step into a long hallway..."

  [[pages.choices]]
  id = 3
  text = "Go back"
  target = 1

[[pages]]
id = 3
name = "Search Results"
content = "You find a flashlight!"

# Rules:
# 1. All IDs (story, page, choice) must be unique numbers
# 2. All choice targets must reference existing page IDs
# 3. start_page must reference an existing page ID
# 4. Page content supports multi-line strings
# 5. Choices array can be empty for ending pages
"#.to_string()
}
