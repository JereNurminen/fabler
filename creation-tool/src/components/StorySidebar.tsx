import styled from "styled-components";
import PageLink from "./PageLink";
import NewPageButton from "./NewPageButton";
import { theme } from "../style";

interface StorySidebarProps {
  storyId: number;
  storyTitle: string;
  pages: Array<{ id: number; name: string }>;
}

export default function StorySidebar({
  storyId,
  storyTitle,
  pages,
}: StorySidebarProps) {
  return (
    <Sidebar>
      <StoryHeading>{storyTitle}</StoryHeading>
      <PageList>
        {pages
          .sort((a, b) => a.id - b.id)
          .map((page) => (
            <PageLink key={page.id} storyId={storyId} pageId={page.id}>
              {`${page.name || `Page ${page.id}`}`}
            </PageLink>
          ))}
        <NewPageButton storyId={storyId} />
      </PageList>
    </Sidebar>
  );
}

const Sidebar = styled.div`
  grid-column: 1;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  flex-gap: ${theme.spacing.m};
  border-right: 1px solid black;
  padding: ${theme.spacing.m} ${theme.spacing.m};
`;

const StoryHeading = styled.h1`
  font-size: 1.5em;
  text-align: center;
  color: palevioletred;
`;

const PageList = styled.div`
  padding: 0;
  display: flex;
  flex-direction: column;
`;
