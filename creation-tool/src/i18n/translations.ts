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
    exportStory: "Export Story",
    exportBundle: "Export .fabler",
    exportSchema: "Export Schema",
    importStory: "Import Story",
    exportSchemaTemplate: "Export Schema Template",
    manageFlags: "Manage Flags",
    addFlag: "Add Flag",
    addCondition: "Add Condition",
    addOperation: "Add Operation",
    menu: "Menu",
    closeMenu: "Close Menu",
    playtest: "Playtest",
    preview: "Preview",
    closePlaytest: "Close Playtest",
    closePreview: "Close Preview",
    openProject: "Open Project",
    newProject: "New Project",
    storyMap: "Story map",
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
    requiredValue: "Required value",
    flag: "Flag",
    playtestMode: "Playtest Mode",
    previewMode: "Preview",
  },

  // Placeholders
  placeholders: {
    storyTitle: "Title",
    storyTitleLong: "Story title",
    choiceText: "Enter choice text...",
    flagName: "Enter flag name...",
    newPageTitle: "Page title:",
  },

  // Headings
  headings: {
    hello: "Hello",
    createNewStory: "Create New Story",
    storySettings: "Story Settings",
    flags: "Flags",
    pages: "Pages",
    assets: "Assets",
    menu: "Menu",
  },

  // Status messages
  status: {
    loading: "Loading...",
    databaseReset: "Database reset successfully",
    selectPage: "Select a page from the sidebar to edit",
    loadingPlaytest: "Loading story for playtest...",
  },

  // Empty states
  emptyStates: {
    noChoices: "No choices yet. Add one below.",
    noFlags: "No flags defined yet.",
    noConditions: "No conditions set.",
    noOperations: "No operations set.",
    noFlagRules: "None yet",
  },

  // Conditions & operations
  conditions: {
    mustBe: "must be",
    mustBeTrue: "must be true",
    mustBeFalse: "must be false",
  },

  operations: {
    set_true: "set_true",
    set_false: "set_false",
    toggle: "toggle",
  },

  // Badges
  badges: {
    start: "START",
    true: "true",
    false: "false",
    flagDefaultTrue: "(true)",
    flagDefaultFalse: "(false)",
  },

  // Alerts
  alerts: {
    storyTitleEmpty: "Story title cannot be empty",
    selectStartPage: "Please select a start page",
    updateSettingsFailed: "Failed to update story settings",
    exportSuccess: "Story exported successfully",
    exportFailed: "Failed to export story",
    importSuccess: "Story imported successfully",
    importFailed: "Failed to import story",
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

  // Story validation
  problems: {
    title: "Problems",
    none: "No problems found",
    storyLevel: "Story",
    goToPage: "Go to page →",
    exportBlockedTitle: "Can't export yet",
    exportBlockedIntro: "Fix these before exporting:",
    close: "Close",
    severity: {
      error: "Error",
      warning: "Warning",
      info: "Info",
    },
    messages: {
      dangling_choice_target: (choiceText: string, target: string) =>
        `Choice "${choiceText}" leads to a page that no longer exists (${target}).`,
      dangling_page_flag_operation: (flagId: string) =>
        `This page sets a flag that no longer exists (${flagId}).`,
      dangling_choice_flag_operation: (choiceText: string, flagId: string) =>
        `Choice "${choiceText}" sets a flag that no longer exists (${flagId}).`,
      dangling_choice_condition: (choiceText: string, flagId: string) =>
        `Choice "${choiceText}" is shown based on a flag that no longer exists (${flagId}).`,
      start_page_unset: () => "This story has no start page set.",
      start_page_missing: (startPage: string) =>
        `The start page does not exist (${startPage}).`,
      unreachable_page: () =>
        "No choice leads to this page, so a reader can never see it.",
    },
  },

  // Save status indicator
  saveStatus: {
    saving: "Saving…",
    saved: "Saved",
    failed: "Couldn't save",
  },

  // Story map
  graph: {
    title: "Story map",
    close: "Close map",
    loading: "Loading story map…",
    loadError: "Couldn't load the story map.",
    retry: "Retry",
    empty: "This story has no pages yet",
    danglingTarget: "leads nowhere",
  },

  // Dynamic strings (with interpolation)
  dynamic: {
    storyListItem: (_id: string, title: string) => `${title}`,
    pageFallback: (id: string) => `Page ${id}`,
    pageDisplay: (name: string, id: string) => name || `Page ${id}`,
    errorMessage: (error: string) => `Error: ${error}`,
    flagFallback: (id: string) => `Flag ${id}`,
    moreFlags: (count: number) => `+${count} more...`,
  },
} as const;

export type TranslationKey = typeof translations;
