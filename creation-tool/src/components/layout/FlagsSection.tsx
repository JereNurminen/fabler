import { Button } from "../ui/Button";
import { useTranslation } from "../../i18n";
import { useStoryAtoms } from "../../atoms/useStoryAtoms";
import clsx from "clsx";

interface FlagsSectionProps {
  onManageFlags: () => void;
}

export const FlagsSection = ({ onManageFlags }: FlagsSectionProps) => {
  const { flags } = useStoryAtoms();
  const { t } = useTranslation();

  return (
    <div className="px-4 py-3">
      <Button
        size="sm"
        onClick={onManageFlags}
        className="w-full mb-3"
      >
        {t.buttons.manageFlags}
      </Button>
      {flags.length > 0 && (
        <div className="space-y-1">
          {flags.slice(0, 5).map((flag) => (
            <div key={flag.id} className="text-xs text-gray-600 truncate">
              {flag.name}{" "}
              {flag.default_value
                ? t.badges.flagDefaultTrue
                : t.badges.flagDefaultFalse}
            </div>
          ))}
          {flags.length > 5 && (
            <button
              className={clsx(
                "text-xs font-medium",
                "text-primary dark:text-blue-400",
                "hover:underline",
              )}
              onClick={onManageFlags}
            >
              {t.dynamic.moreFlags(flags.length - 5)}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
