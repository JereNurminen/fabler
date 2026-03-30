export interface Story {
  format_version: number;
  title: string;
  start_page: string;
  flags: Flag[];
}

export interface Flag {
  id: string;
  name: string;
  default_value: boolean;
}

export interface Page {
  id: string;
  name: string;
  body: string;
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
