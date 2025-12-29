import styled from "styled-components";
import { Page } from "../bindings";
import {
  handleLoadable,
  isLoadedAndSuccess,
  Loadable,
  notLoaded,
  useStoryContext,
} from "../StoryContext";
import LoadingSpinner from "./LoadingSpinner";
import Error from "./Error";
import { useCallback, useEffect, useState } from "react";
import { theme } from "../style";

export default ({ pageId }: { pageId: number }) => {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [page, setPage] = useState<Loadable<Page>>(notLoaded<Page>());
  const { getPage, patchPage } = useStoryContext();

  useEffect(() => {
    async function loadPage() {
      const loadedPage = await getPage(pageId);
      setPage(loadedPage);
    }
    void loadPage();
  }, [pageId]);

  useEffect(() => {
    if (isLoadedAndSuccess(page)) {
      setName(page.value.data.name);
      setBody(page.value.data.body);
    }
  }, [page]);

  const patch = useCallback(async () => {
    await patchPage({ id: pageId, name, body });
  }, [pageId, name, body]);

  return handleLoadable(
    page,
    () => <LoadingSpinner />,
    ({ data }) => (
      <PageCard key={data.id}>
        <Label htmlFor="page-title-input">
          Page title:
          <SingleLineInput
            type="text"
            id="page-title-input"
            onChange={(e) => setName(e.target.value)}
            onBlur={patch}
            value={name}
          />
        </Label>
        <Label htmlFor="page-body-input">
          Page content:
          <MultiLineInput
            type="textarea"
            id="page-body-input"
            onChange={(e) => setBody(e.target.value)}
            onBlur={patch}
            value={body}
          />
        </Label>
      </PageCard>
    ),
    (error) => <Error error={error.error} />,
  );
};

const PageCard = styled.div`
  margin: 10px;
  padding: 10px;
  border: 1px solid black;
  border-radius: 5px;
`;

const Label = styled.label`
  font-size: ${theme.fonts.size.s};
  width: 100%;
`;

const Input = styled.input`
  font-size: ${theme.fonts.size.m};
  width: 100%;
`;

const SingleLineInput = styled(Input)``;

const MultiLineInput = styled(Input)``;
