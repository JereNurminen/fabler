import { translations } from "../i18n";
import type { ProblemDetail } from "@fabler/types";

/**
 * Render a structured problem from the Rust validator into a sentence.
 * The backend deliberately returns codes and fields rather than prose so all
 * user-facing wording stays in translations.ts.
 */
export function problemMessage(detail: ProblemDetail): string {
  const m = translations.problems.messages;
  switch (detail.code) {
    case "dangling_choice_target":
      return m.dangling_choice_target(detail.choice_text, detail.target);
    case "dangling_page_flag_operation":
      return m.dangling_page_flag_operation(detail.flag_id);
    case "dangling_choice_flag_operation":
      return m.dangling_choice_flag_operation(detail.choice_text, detail.flag_id);
    case "dangling_choice_condition":
      return m.dangling_choice_condition(detail.choice_text, detail.flag_id);
    case "start_page_unset":
      return m.start_page_unset();
    case "start_page_missing":
      return m.start_page_missing(detail.start_page);
    case "unreachable_page":
      return m.unreachable_page();
  }
}
