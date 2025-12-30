import styled from "styled-components";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { theme } from "../style";
import { pageAtomFamily } from "../atoms/storyAtoms";
import { useStoryAtoms } from "../atoms/useStoryAtoms";

export default ({ pageId }: { pageId: number }) => {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [page] = useAtom(pageAtomFamily(pageId));
  const { patchPage } = useStoryAtoms();

  useEffect(() => {
    if (page) {
      setName(page.name);
      setBody(page.body);
    }
  }, [page]);

  const patch = useCallback(async () => {
    try {
      await patchPage({ id: pageId, name, body });
    } catch (error) {
      console.error("Failed to patch page:", error);
    }
  }, [pageId, name, body, patchPage]);

  if (!page) return null;

  return (
    <PageCard key={page.id}>
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
