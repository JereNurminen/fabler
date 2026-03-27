import type {
  Manifest,
  ManifestPage,
  ManifestChoice,
  ManifestFlagOperation,
  ManifestCondition,
} from "@fabler/player/engine/types";
import type {
  Page,
  Flag,
  StoryOutline,
  Choice,
  FlagOperation,
  ChoiceCondition,
} from "../bindings";

export function convertFlagOperation(op: FlagOperation): ManifestFlagOperation {
  return {
    flag_id: String(op.flag_id),
    operation: op.operation as ManifestFlagOperation["operation"],
  };
}

export function convertCondition(cond: ChoiceCondition): ManifestCondition {
  return {
    flag_id: String(cond.flag_id),
    required_value: cond.required_value,
  };
}

export function convertChoice(choice: Choice): ManifestChoice {
  return {
    id: String(choice.id),
    text: choice.text,
    target: String(choice.target_page),
    flag_operations: choice.flag_operations.map(convertFlagOperation),
    conditions: choice.conditions.map(convertCondition),
  };
}

export function convertPageToManifestPage(page: Page): ManifestPage {
  return {
    id: String(page.id),
    name: page.name,
    body: page.body,
    assets: [],
    flag_operations: page.flag_operations.map(convertFlagOperation),
    choices: page.options.map(convertChoice),
  };
}

export function convertToManifest(
  outline: StoryOutline,
  fullPages: Page[],
  flags: Flag[]
): Manifest {
  return {
    format_version: 1,
    story: {
      id: String(outline.id),
      title: outline.title,
      start_page: String(outline.start_page),
    },
    flags: flags.map((flag) => ({
      id: String(flag.id),
      name: flag.name,
      default_value: flag.default_value,
    })),
    pages: fullPages.map(convertPageToManifestPage),
  };
}
