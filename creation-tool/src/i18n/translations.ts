export const translations = {
  // Buttons
  buttons: {
    create: "Create",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    addChoice: "Add Choice",
    createPage: "Create Page",
    newStory: "New Story",
    goToPage: "Go to page →",
  },

  // Labels
  labels: {
    pageTitle: "Page title:",
    pageContent: "Page content:",
    choiceText: "Choice text:",
    leadsTo: "Leads to:",
    storyTitle: "Story Title",
    startPage: "Start Page",
    choices: "Choices:",
  },

  // Placeholders
  placeholders: {
    storyTitle: "Title",
    storyTitleLong: "Story title",
    choiceText: "Enter choice text...",
  },

  // Headings
  headings: {
    hello: "Hello",
    storySettings: "Story Settings",
  },

  // Status messages
  status: {
    loading: "Loading...",
    databaseReset: "Database reset successfully",
  },

  // Empty states
  emptyStates: {
    noChoices: "No choices yet. Add one below.",
  },

  // Badges
  badges: {
    start: "START",
  },

  // Alerts
  alerts: {
    storyTitleEmpty: "Story title cannot be empty",
    selectStartPage: "Please select a start page",
    updateSettingsFailed: "Failed to update story settings",
  },

  // Error messages
  errors: {
    prefix: "Error: ",
  },

  // Dynamic strings (with interpolation)
  dynamic: {
    storyListItem: (id: number, title: string) => `${id}: ${title}`,
    pageFallback: (id: number) => `Page ${id}`,
    pageDisplay: (name: string, id: number) => name || `Page ${id}`,
    errorMessage: (error: string) => `Error: ${error}`,
  },
} as const;

export type TranslationKey = typeof translations;
