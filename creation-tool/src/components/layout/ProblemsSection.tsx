import { useLocation } from "wouter";
import { useValidation } from "../../atoms/useStoryAtoms";
import { getLinkToPage } from "../../utilities/routing";
import { ProblemList } from "../ProblemList";

interface ProblemsSectionProps {
  /** Called after navigating, so the portrait modal can close itself. */
  onNavigate?: () => void;
}

export const ProblemsSection = ({ onNavigate }: ProblemsSectionProps) => {
  const { problems } = useValidation();
  const [, setLocation] = useLocation();

  return (
    <ProblemList
      problems={problems}
      onNavigate={(pageId) => {
        setLocation(getLinkToPage(pageId));
        onNavigate?.();
      }}
    />
  );
};
