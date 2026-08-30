import { useTranslation } from "../i18n";
import type { Problem, Severity } from "../types";
import { problemMessage } from "../utilities/problemMessage";
import clsx from "clsx";

interface ProblemListProps {
  problems: Problem[];
  /** Called with the page id when the author follows a problem's link. */
  onNavigate?: (pageId: string) => void;
}

const CONTAINER_CLASSES: Record<Severity, string> = {
  error: "bg-red-50 border-red-200",
  warning: "bg-amber-50 border-amber-200",
  info: "bg-blue-50 border-blue-200",
};

const LABEL_CLASSES: Record<Severity, string> = {
  error: "text-red-700",
  warning: "text-amber-700",
  info: "text-blue-700",
};

export const ProblemList = ({ problems, onNavigate }: ProblemListProps) => {
  const { t } = useTranslation();

  if (problems.length === 0) {
    return (
      <p className="p-3 text-xs text-gray-500 italic" data-testid="problems-empty">
        {t.problems.none}
      </p>
    );
  }

  return (
    <ul className="list-none p-2 m-0 space-y-2" data-testid="problem-list">
      {problems.map((problem, i) => (
        <li
          key={`${problem.page_id ?? "story"}-${problem.detail.code}-${i}`}
          className={clsx("p-2.5 rounded border text-xs", CONTAINER_CLASSES[problem.severity])}
          data-testid={`problem-${problem.detail.code}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className={clsx(
                "font-semibold uppercase tracking-wide text-[10px]",
                LABEL_CLASSES[problem.severity],
              )}
            >
              {t.problems.severity[problem.severity]}
            </span>
            <span className="font-medium text-gray-900">
              {problem.page_name ?? t.problems.storyLevel}
            </span>
          </div>
          <p className="text-gray-700">{problemMessage(problem.detail)}</p>
          {problem.page_id && onNavigate && (
            <button
              onClick={() => onNavigate(problem.page_id as string)}
              className="mt-1.5 text-primary hover:underline font-medium"
            >
              {t.problems.goToPage}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};
