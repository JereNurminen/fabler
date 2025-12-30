import styled from "styled-components";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { theme } from "../style";
import { pageAtomFamily, allPagesAtom } from "../atoms/storyAtoms";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { useTranslation } from "../i18n";
import type { Choice } from "../bindings";
import { useLocation } from "wouter";
import { getLinkToPagePage } from "../utilities/routing";

export default ({ pageId }: { pageId: number }) => {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [page] = useAtom(pageAtomFamily(pageId));
  const pages = useAtomValue(allPagesAtom);
  const { patchPage, createChoice, deleteChoice, patchChoice } = useStoryAtoms();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (page) {
      setName(page.name);
      setBody(page.body);
      setChoices(page.options);
    }
  }, [page]);

  const patch = useCallback(async () => {
    try {
      await patchPage({ id: pageId, name, body });
    } catch (error) {
      console.error("Failed to patch page:", error);
    }
  }, [pageId, name, body, patchPage]);

  const handleCreateChoice = async () => {
    if (!page) return;

    try {
      // Create with empty text, defaulting to first available page
      const defaultTargetPage = pages[0]?.id || page.id;
      const newChoiceId = await createChoice({
        pageId: page.id,
        text: "",
        targetPageId: defaultTargetPage,
      });

      // Optimistically add to local state
      setChoices([
        ...choices,
        {
          id: newChoiceId,
          page_id: page.id,
          text: "",
          target_page: defaultTargetPage,
        },
      ]);
    } catch (error) {
      console.error("Failed to create choice:", error);
    }
  };

  const handleDeleteChoice = async (choiceId: number) => {
    if (!page) return;

    try {
      // Optimistically remove from local state
      setChoices(choices.filter((c) => c.id !== choiceId));

      await deleteChoice({ choiceId, pageId: page.id });
    } catch (error) {
      console.error("Failed to delete choice:", error);
      // On error, refetch to restore correct state
      if (page) {
        setChoices(page.options);
      }
    }
  };

  const handlePatchChoice = async (
    choiceId: number,
    updates: { text?: string; target_page?: number }
  ) => {
    if (!page) return;

    try {
      await patchChoice({
        patch: {
          id: choiceId,
          text: updates.text !== undefined ? updates.text : null,
          target_page: updates.target_page !== undefined ? updates.target_page : null,
        },
        pageId: page.id,
      });
    } catch (error) {
      console.error("Failed to patch choice:", error);
    }
  };

  if (!page) return null;

  return (
    <PageCard key={page.id}>
      <Label htmlFor="page-title-input">
        {t.labels.pageTitle}
        <SingleLineInput
          type="text"
          id="page-title-input"
          onChange={(e) => setName(e.target.value)}
          onBlur={patch}
          value={name}
        />
      </Label>
      <Label htmlFor="page-body-input">
        {t.labels.pageContent}
        <MultiLineInput
          type="textarea"
          id="page-body-input"
          onChange={(e) => setBody(e.target.value)}
          onBlur={patch}
          value={body}
        />
      </Label>

      <ChoicesSection>
        <SectionLabel>{t.labels.choices}</SectionLabel>

        {choices.length === 0 ? (
          <EmptyState>{t.emptyStates.noChoices}</EmptyState>
        ) : (
          <ChoicesList>
            {choices.map((choice) => (
              <ChoiceItem key={choice.id}>
                <ChoiceInputs>
                  <Label htmlFor={`choice-text-${choice.id}`}>
                    {t.labels.choiceText}
                    <Input
                      type="text"
                      id={`choice-text-${choice.id}`}
                      value={choice.text}
                      onChange={(e) => {
                        // Update local state immediately
                        setChoices(
                          choices.map((c) =>
                            c.id === choice.id ? { ...c, text: e.target.value } : c
                          )
                        );
                      }}
                      onBlur={() =>
                        handlePatchChoice(choice.id, { text: choice.text })
                      }
                      placeholder={t.placeholders.choiceText}
                    />
                  </Label>

                  <Label htmlFor={`choice-target-${choice.id}`}>
                    {t.labels.leadsTo}
                    <TargetPageRow>
                      <Select
                        id={`choice-target-${choice.id}`}
                        value={choice.target_page}
                        onChange={(e) => {
                          const newTarget = parseInt(e.target.value);
                          // Update local state immediately
                          setChoices(
                            choices.map((c) =>
                              c.id === choice.id ? { ...c, target_page: newTarget } : c
                            )
                          );
                          // Update immediately (no blur needed for select)
                          handlePatchChoice(choice.id, { target_page: newTarget });
                        }}
                      >
                        {pages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {t.dynamic.pageDisplay(p.name, p.id)}
                          </option>
                        ))}
                      </Select>
                      <GoToPageLink
                        onClick={() =>
                          setLocation(
                            getLinkToPagePage(page.story_id, choice.target_page)
                          )
                        }
                      >
                        {t.buttons.goToPage}
                      </GoToPageLink>
                    </TargetPageRow>
                  </Label>
                </ChoiceInputs>

                <DeleteButton onClick={() => handleDeleteChoice(choice.id)}>
                  {t.buttons.delete}
                </DeleteButton>
              </ChoiceItem>
            ))}
          </ChoicesList>
        )}

        <AddButton onClick={handleCreateChoice}>{t.buttons.addChoice}</AddButton>
      </ChoicesSection>
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

const ChoicesSection = styled.div`
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SectionLabel = styled.h3`
  font-size: ${theme.fonts.size.m};
  margin: 0;
  padding: 0;
`;

const EmptyState = styled.div`
  font-size: ${theme.fonts.size.s};
  color: #999;
  font-style: italic;
  padding: 10px 0;
`;

const ChoicesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const ChoiceItem = styled.div`
  border: 1px solid #e6e6e6;
  border-radius: 5px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background-color: #fafafa;
`;

const ChoiceInputs = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TargetPageRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const Select = styled.select`
  font-size: ${theme.fonts.size.m};
  flex: 1;
  padding: 4px;
`;

const GoToPageLink = styled.button`
  background: none;
  border: none;
  color: #2196f3;
  cursor: pointer;
  font-size: ${theme.fonts.size.s};
  text-decoration: underline;
  white-space: nowrap;
  padding: 0;

  &:hover {
    color: #1976d2;
  }
`;

const DeleteButton = styled.button`
  align-self: flex-end;
  background-color: ${theme.colors.light.danger};
  color: white;
  border: none;
  border-radius: 3px;
  padding: 5px 10px;
  font-size: ${theme.fonts.size.s};
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }
`;

const AddButton = styled.button`
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 3px;
  padding: 8px 16px;
  font-size: ${theme.fonts.size.m};
  cursor: pointer;
  margin-top: 5px;

  &:hover {
    opacity: 0.8;
  }
`;
