import { Link } from "wouter";
import { getLinkToPage } from "../utilities/routing";
import { PropsWithChildren, type MouseEvent as ReactMouseEvent } from "react";
import clsx from "clsx";

const PageLink = ({
  pageId,
  children,
  onClick,
  onContextMenu,
}: PropsWithChildren<{
  pageId: string;
  onClick?: () => void;
  onContextMenu?: (event: ReactMouseEvent) => void;
}>) => {
  // Base structure
  const base = clsx(
    "block no-underline",
    "p-2.5 rounded",
    "transition-colors"
  );

  // Light mode colors
  const light = clsx(
    "text-gray-900 bg-white",
    "border border-gray-300",
    "hover:bg-gray-100"
  );

  // Dark mode colors
  const dark = clsx(
    "dark:text-gray-100 dark:bg-gray-800",
    "dark:border-gray-600",
    "dark:hover:bg-gray-700"
  );

  return (
    <Link
      to={getLinkToPage(pageId)}
      className={clsx(base, light, dark)}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {children}
    </Link>
  );
};

export default PageLink;
