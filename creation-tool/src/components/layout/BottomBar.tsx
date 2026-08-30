import { useState } from "react";
import {
  Cog6ToothIcon,
  FlagIcon,
  DocumentTextIcon,
  PhotoIcon,
  PlayIcon,
  EyeIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useTranslation } from "../../i18n";
import { useStoryAtoms, useValidation } from "../../atoms/useStoryAtoms";
import { useEditorChrome } from "./EditorChromeContext";
import { FlagsDialog } from "../FlagsDialog";
import { SectionModal } from "./SectionModal";
import { StorySettingsSection } from "./StorySettingsSection";
import { PagesSection } from "./PagesSection";
import { FlagsSection } from "./FlagsSection";
import { AssetsSection } from "./AssetsSection";
import { ProblemsSection } from "./ProblemsSection";
import clsx from "clsx";

type ActiveModal =
  | "pages"
  | "flags"
  | "settings"
  | "assets"
  | "problems"
  | null;

export const BottomBar = () => {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [showFlagsDialog, setShowFlagsDialog] = useState(false);
  const { t } = useTranslation();
  const { story, pages } = useStoryAtoms();
  const { problems } = useValidation();
  const { onPlaytest, onTogglePreview, showPreview, hasPageSelected } =
    useEditorChrome();
  const storyTitle = story?.title ?? "";
  const startPage = story?.start_page ?? null;

  const handleToggleModal = (modal: ActiveModal) => {
    setActiveModal((prev) => (prev === modal ? null : modal));
  };

  const handleManageFlags = () => {
    setActiveModal(null);
    setShowFlagsDialog(true);
  };

  const iconButtonClass = clsx(
    "relative flex flex-col items-center justify-center",
    "min-w-[44px] min-h-[44px] px-2 py-1",
    "text-gray-600 rounded-lg",
    "transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
  );

  return (
    <>
      {/* Bottom Bar */}
      <div className="layout-bottombar fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 items-center justify-around px-2 py-1 safe-area-bottom">
        <button
          onClick={() => handleToggleModal("pages")}
          className={clsx(
            iconButtonClass,
            activeModal === "pages" && "bg-gray-100 text-gray-900",
          )}
          aria-label={t.headings.pages}
        >
          <DocumentTextIcon className="w-6 h-6" />
          <span className="text-xs mt-0.5">{t.headings.pages}</span>
          {pages.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-white text-xs font-semibold min-w-[1.25rem] h-5 flex items-center justify-center rounded-full">
              {pages.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleToggleModal("flags")}
          className={clsx(
            iconButtonClass,
            activeModal === "flags" && "bg-gray-100 text-gray-900",
          )}
          aria-label={t.headings.flags}
        >
          <FlagIcon className="w-6 h-6" />
          <span className="text-xs mt-0.5">{t.headings.flags}</span>
        </button>

        <button
          onClick={() => handleToggleModal("problems")}
          className={clsx(
            iconButtonClass,
            activeModal === "problems" && "bg-gray-100 text-gray-900",
          )}
          aria-label={t.problems.title}
        >
          <ExclamationTriangleIcon className="w-6 h-6" />
          <span className="text-xs mt-0.5">{t.problems.title}</span>
          {problems.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-danger text-white text-xs font-semibold min-w-[1.25rem] h-5 flex items-center justify-center rounded-full">
              {problems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleToggleModal("assets")}
          className={clsx(
            iconButtonClass,
            activeModal === "assets" && "bg-gray-100 text-gray-900",
          )}
          aria-label={t.headings.assets}
        >
          <PhotoIcon className="w-6 h-6" />
          <span className="text-xs mt-0.5">{t.headings.assets}</span>
        </button>

        <button
          onClick={() => handleToggleModal("settings")}
          className={clsx(
            iconButtonClass,
            activeModal === "settings" && "bg-gray-100 text-gray-900",
          )}
          aria-label={t.headings.storySettings}
        >
          <Cog6ToothIcon className="w-6 h-6" />
          <span className="text-xs mt-0.5">{t.headings.storySettings}</span>
        </button>

        <button
          onClick={onPlaytest}
          className={clsx(iconButtonClass, "text-indigo-600")}
          aria-label={t.buttons.playtest}
        >
          <PlayIcon className="w-6 h-6" />
          <span className="text-xs mt-0.5">{t.buttons.playtest}</span>
        </button>

        {hasPageSelected && (
          <button
            onClick={onTogglePreview}
            className={clsx(
              iconButtonClass,
              showPreview && "bg-blue-100 text-blue-700",
            )}
            aria-label={t.buttons.preview}
          >
            <EyeIcon className="w-6 h-6" />
            <span className="text-xs mt-0.5">{t.buttons.preview}</span>
          </button>
        )}
      </div>

      {/* Pages Modal */}
      <SectionModal
        open={activeModal === "pages"}
        onClose={() => setActiveModal(null)}
        title={t.headings.pages}
      >
        <PagesSection
          pages={pages}
          startPage={startPage}
          onPageClick={() => setActiveModal(null)}
        />
      </SectionModal>

      {/* Flags Modal */}
      <SectionModal
        open={activeModal === "flags"}
        onClose={() => setActiveModal(null)}
        title={t.headings.flags}
      >
        <FlagsSection onManageFlags={handleManageFlags} />
      </SectionModal>

      {/* Assets Modal */}
      <SectionModal
        open={activeModal === "assets"}
        onClose={() => setActiveModal(null)}
        title={t.headings.assets}
      >
        <AssetsSection />
      </SectionModal>

      {/* Problems Modal */}
      <SectionModal
        open={activeModal === "problems"}
        onClose={() => setActiveModal(null)}
        title={t.problems.title}
      >
        <ProblemsSection onNavigate={() => setActiveModal(null)} />
      </SectionModal>

      {/* Settings Modal */}
      <SectionModal
        open={activeModal === "settings"}
        onClose={() => setActiveModal(null)}
        title={t.headings.storySettings}
      >
        <StorySettingsSection
          storyTitle={storyTitle}
          pages={pages}
          startPage={startPage}
        />
      </SectionModal>

      {/* Full Flags Dialog */}
      {showFlagsDialog && (
        <FlagsDialog onClose={() => setShowFlagsDialog(false)} />
      )}
    </>
  );
};
