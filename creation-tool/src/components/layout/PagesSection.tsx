import { useTranslation } from "../../i18n";
import PageLink from "../PageLink";
import NewPageButton from "../NewPageButton";

interface PagesSectionProps {
  pages: Array<{ id: string; name: string }>;
  startPage: string | null;
  onPageClick?: () => void;
}

export const PagesSection = ({
  pages,
  startPage,
  onPageClick,
}: PagesSectionProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="space-y-1 p-2">
        {pages
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((page) => (
            <PageLink key={page.id} pageId={page.id} onClick={onPageClick}>
              {page.id === startPage && (
                <span className="inline-block bg-primary text-white text-xs font-bold px-2 py-0.5 rounded mr-2">
                  {t.badges.start}
                </span>
              )}
              {page.name || page.id}
            </PageLink>
          ))}
      </div>
      <div className="p-2 border-t border-gray-200">
        <NewPageButton />
      </div>
    </>
  );
};
