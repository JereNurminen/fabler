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
import { Editable } from "./Editable";
import { useCallback, useEffect, useState } from "react";

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
        <Editable
          inputType="single-line"
          onEdit={(value) => setName(value)}
          value={name}
          onBlur={patch}
        >
          <PageTitle>{name}</PageTitle>
        </Editable>
        <Editable
          inputType="multi-line"
          onEdit={(value) => setBody(value)}
          value={body}
          onBlur={patch}
        >
          <PageBody>{body}</PageBody>
        </Editable>
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

const PageTitle = styled.h2`
  font-size: 1.2em;
  color: palevioletred;
`;

const PageBody = styled.p`
  color: black;
  min-height: 100px;
  border: 1px solid black;
`;
