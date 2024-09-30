import { Link } from "wouter";
import { getLinkToPagePage } from "../utilities/routing";
import { PropsWithChildren } from "react";
import styled from "styled-components";

export default ({
  storyId,
  pageId,
  children,
}: PropsWithChildren<{ storyId: number; pageId: number }>) => (
  <Link to={getLinkToPagePage(storyId, pageId)}>{children}</Link>
);

const PageLink = styled(Link)`
  text-decoration: none;
  color: black;
  display: block;
  padding: 10px;
  border: 1px solid black;
  margin: 10px;
  border-radius: 5px;
  background-color: white;
  transition: background-color 0.2s;
  &:hover {
    background-color: #f0f0f0;
  }
`;
