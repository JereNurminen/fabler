export interface Story {
  format_version: number;
  /** Stable identity, carried into exported bundles. */
  id: string;
  title: string;
  start_page: string;
  flags: Flag[];
}

export interface Flag {
  id: string;
  name: string;
  default_value: boolean;
}

// -- Rich text document types --

export interface Document {
  content: Block[];
}

export type Block =
  | { type: "paragraph"; content: Inline[] }
  | { type: "blockquote"; content: Block[] }
  | { type: "image"; src: string; alt: string }
  | { type: "horizontal_rule" }
  | { type: "markdown"; source: string };

export interface Inline {
  text: string;
  marks: Mark[];
}

export type Mark = "bold" | "italic";

export interface Page {
  id: string;
  name: string;
  body: Document;
  choices: Choice[];
  flag_operations: FlagOperation[];
}

export interface Choice {
  id: string;
  text: string;
  target: string;
  flag_operations: FlagOperation[];
  conditions: Condition[];
}

export interface FlagOperation {
  flag_id: string;
  operation: "set_true" | "set_false" | "toggle";
}

export interface Condition {
  flag_id: string;
  required_value: boolean;
}

export interface PageListItem {
  id: string;
  name: string;
}

// -- Story validation --

export type Severity = "error" | "warning" | "info";

export type ProblemDetail =
  | { code: "dangling_choice_target"; choice_id: string; choice_text: string; target: string }
  | { code: "dangling_page_flag_operation"; flag_id: string }
  | { code: "dangling_choice_flag_operation"; choice_id: string; choice_text: string; flag_id: string }
  | { code: "dangling_choice_condition"; choice_id: string; choice_text: string; flag_id: string }
  | { code: "start_page_unset" }
  | { code: "start_page_missing"; start_page: string }
  | { code: "unreachable_page" };

export interface Problem {
  severity: Severity;
  /** Null for story-level problems that belong to no page. */
  page_id: string | null;
  page_name: string | null;
  detail: ProblemDetail;
}

export interface ValidationReport {
  problems: Problem[];
}
