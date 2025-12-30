export const translations = {
  // Buttons
  buttons: {
    create: "Create",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    close: "Close",
    addChoice: "Add Choice",
    createPage: "Create Page",
    newStory: "New Story",
    goToPage: "Go to page →",
    exportSchema: "Export Schema Template",
    manageFlags: "Manage Flags",
    addFlag: "Add Flag",
    addCondition: "Add Condition",
    addOperation: "Add Operation",
    menu: "Menu",
    closeMenu: "Close Menu",
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
    flagName: "Flag Name",
    defaultValue: "Default Value",
    showChoiceIf: "Show this choice only if:",
    whenSelected: "When selected, set flags:",
    whenPageShown: "When page is shown, set flags:",
    operation: "Operation",
    requiredValue: "Required Value",
    flag: "Flag",
  },

  // Placeholders
  placeholders: {
    storyTitle: "Title",
    storyTitleLong: "Story title",
    choiceText: "Enter choice text...",
    flagName: "Enter flag name...",
  },

  // Headings
  headings: {
    hello: "Hello",
    createNewStory: "Create New Story",
    storySettings: "Story Settings",
    flags: "Flags",
  },

  // Status messages
  status: {
    loading: "Loading...",
    databaseReset: "Database reset successfully",
    selectPage: "Select a page from the sidebar to edit",
  },

  // Empty states
  emptyStates: {
    noChoices: "No choices yet. Add one below.",
    noFlags: "No flags defined yet.",
    noConditions: "No conditions set.",
    noOperations: "No operations set.",
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
    exportSuccess: "Story exported successfully",
    exportFailed: "Failed to export story",
    schemaExported: "Schema exported successfully",
    schemaExportFailed: "Failed to export schema",
    flagNameEmpty: "Flag name cannot be empty",
    flagCreated: "Flag created successfully",
    flagDeleted: "Flag deleted successfully",
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
