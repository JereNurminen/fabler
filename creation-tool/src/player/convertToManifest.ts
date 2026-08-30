import type { Manifest } from "@fabler/player/engine/types";
import type { Page, Story } from "@fabler/types";

export function convertToManifest(
  story: Story,
  pages: Page[],
): Manifest {
  return {
    format_version: story.format_version,
    story: {
      id: story.id,
      title: story.title,
      start_page: story.start_page,
    },
    flags: story.flags.map((f) => ({
      id: f.id,
      name: f.name,
      default_value: f.default_value,
    })),
    pages: pages.map((p) => ({
      id: p.id,
      name: p.name,
      body: p.body,
      flag_operations: (p.flag_operations || []).map((op) => ({
        flag_id: op.flag_id,
        operation: op.operation,
      })),
      choices: (p.choices || []).map((c) => ({
        id: c.id,
        text: c.text,
        target: c.target,
        flag_operations: (c.flag_operations || []).map((op) => ({
          flag_id: op.flag_id,
          operation: op.operation,
        })),
        conditions: (c.conditions || []).map((cond) => ({
          flag_id: cond.flag_id,
          required_value: cond.required_value,
        })),
      })),
    })),
  };
}

export function convertPageToManifestPage(page: Page) {
  return {
    id: page.id,
    name: page.name,
    body: page.body,
    flag_operations: (page.flag_operations || []).map((op) => ({
      flag_id: op.flag_id,
      operation: op.operation,
    })),
    choices: (page.choices || []).map((c) => ({
      id: c.id,
      text: c.text,
      target: c.target,
      flag_operations: (c.flag_operations || []).map((op) => ({
        flag_id: op.flag_id,
        operation: op.operation,
      })),
      conditions: (c.conditions || []).map((cond) => ({
        flag_id: cond.flag_id,
        required_value: cond.required_value,
      })),
    })),
  };
}
