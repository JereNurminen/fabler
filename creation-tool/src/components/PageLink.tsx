import { Link } from "wouter";
import { getLinkToPagePage } from "../utilities/routing";
import { PropsWithChildren } from "react";

export default ({
  storyId,
  pageId,
  children,
  onClick,
}: PropsWithChildren<{
  storyId: number;
  pageId: number;
  onClick?: () => void;
}>) => (
  <Link
    to={getLinkToPagePage(storyId, pageId)}
    className="block no-underline text-gray-900 p-2.5 border border-gray-300 rounded bg-white transition-colors hover:bg-gray-100"
    onClick={onClick}
  >
    {children}
  </Link>
);
