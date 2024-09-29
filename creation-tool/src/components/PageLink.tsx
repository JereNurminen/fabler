import { Link } from "wouter";
import { getLinkToPagePage } from "../utilities/routing";
import { PropsWithChildren } from "react";

export default ({ storyId, pageId, children }: PropsWithChildren<{ storyId: number, pageId: number }>) =>
    <Link to={getLinkToPagePage(storyId, pageId)}>{children}</Link>
