import { useTranslation } from "../../i18n";
import PageLink from "../PageLink";
import NewPageButton from "../NewPageButton";
import { ContextMenu } from "../ui/ContextMenu";
import { useContextMenu } from "../../hooks/useContextMenu";
import { useTrashPage } from "../TrashPageContext";

interface PagesSectionProps {
  pages: Array<{ id: string; name: string }>;
  startPage: string | null;
  onPageClick?: () => void;
}

export const PagesSection = ({ pages, startPage, onPageClick }: PagesSectionProps) => {
  const { t } = useTranslation();
  const { menu, openAt, close } = useContextMenu<string>();
  const { requestTrash } = useTrashPage();

  return (
    <>
      <div className="space-y-1 p-2">
        {pages
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((page) => (
            <PageLink
              key={page.id}
              pageId={page.id}
              onClick={onPageClick}
              onContextMenu={(event) => openAt(event, page.id)}
            >
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
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={close}
          items={[
            {
              label: t.buttons.deletePage,
              variant: "danger",
              onSelect: () => requestTrash(menu.target),
            },
          ]}
        />
      )}
    </>
  );
};
