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

# Array of flags (optional)
# Flags are boolean variables that can control story flow
[[flags]]
# Flag ID (required, number)
id = 1

# Flag name (required)
name = "has_flashlight"

# Default value when story starts (required, boolean)
default_value = false

[[flags]]
id = 2
name = "door_unlocked"
default_value = false

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

  # Array of flag operations performed when page is shown (optional)
  [[pages.flag_operations]]
  # Flag ID to modify (required, number)
  flag_id = 1

  # Operation to perform (required, string)
  # Valid values: "set_true", "set_false", "toggle"
  operation = "set_true"

  # Array of choices available on this page (optional)
  [[pages.choices]]
  # Choice ID (required, number)
  id = 1

  # Choice text displayed to the player (required)
  text = "Open the door"

  # Target page ID this choice leads to (required, number)
  # Must match a page ID defined in this file
  target = 2

    # Array of flag operations performed when choice is selected (optional)
    [[pages.choices.flag_operations]]
    flag_id = 2
    operation = "set_true"

    # Array of conditions that must be met to show this choice (optional)
    [[pages.choices.conditions]]
    # Flag ID to check (required, number)
    flag_id = 1

    # Required value for the flag (required, boolean)
    # Choice is only shown if flag matches this value
    required_value = true

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
# 1. All IDs (story, page, choice, flag) must be unique numbers
# 2. All choice targets must reference existing page IDs
# 3. start_page must reference an existing page ID
# 4. Page content supports multi-line strings
# 5. Choices array can be empty for ending pages
# 6. Flag operations reference flag IDs defined in the flags array
# 7. Choice conditions use AND logic (all must be true)
# 8. Operations: "set_true" sets flag to true, "set_false" to false, "toggle" flips value
"#.to_string()
}
