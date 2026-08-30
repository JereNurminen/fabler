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
