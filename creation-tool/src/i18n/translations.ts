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
    deletePage: "Delete page",
    moveToTrash: "Move to trash",
    restore: "Restore",
    deletePermanently: "Delete permanently",
    emptyTrash: "Empty trash",
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
    trash: "Trash",
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
      choice_targets_trashed_page: (choiceText: string, targetName: string) =>
        `Choice "${choiceText}" leads to "${targetName}", which is in the trash.`,
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
    autoArrange: "Auto-arrange",
  },

  // Trash / soft-delete
  trash: {
    confirmTitle: "Delete this page?",
    confirmIntro: (pageName: string) =>
      `"${pageName}" will be moved to the trash. You can restore it later.`,
    startPageWarning:
      "This is your story's start page. Your story will have no entry point until you set a new one.",
    strandedIntro: (count: number) =>
      count === 1
        ? "1 choice on another page leads here and will break:"
        : `${count} choices on other pages lead here and will break:`,
    strandedItem: (pageName: string, choiceText: string) =>
      `${pageName} — "${choiceText}"`,
    empty: "The trash is empty.",
    bannerTitle: "This page is in the trash",
    bannerBody: "It cannot be edited, it is not exported, and its problems are ignored.",
    purgeTitle: "Delete permanently?",
    purgeIntro: (pageName: string) =>
      `"${pageName}" will be gone for good. This cannot be undone.`,
    purgeDowngradeWarning: (count: number) =>
      count === 1
        ? "1 choice still points at this page. Deleting it permanently means that choice can only be fixed by retargeting it, not by restoring the page."
        : `${count} choices still point at this page. Deleting it permanently means those choices can only be fixed by retargeting them, not by restoring the page.`,
    emptyTrashTitle: "Empty the trash?",
    emptyTrashIntro: (count: number) =>
      count === 1
        ? "1 page will be deleted for good. This cannot be undone."
        : `${count} pages will be deleted for good. This cannot be undone.`,
  },

  // Dynamic strings (with interpolation)
  dynamic: {
    storyListItem: (_id: string, title: string) => `${title}`,
    pageFallback: (id: string) => `Page ${id}`,
    pageDisplay: (name: string, id: string) => name || `Page ${id}`,
    errorMessage: (error: string) => `Error: ${error}`,
    flagFallback: (id: string) => `Flag ${id}`,
    moreFlags: (count: number) => `+${count} more...`,
    pageInTrash: (name: string) => `${name} (in trash)`,
  },
} as const;

export type TranslationKey = typeof translations;
