import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { useTranslation } from "../i18n";
import styled from "styled-components";
import { useLocation } from "wouter";
import { getLinkToPagePage } from "../utilities/routing";

interface NewPageButtonProps {
  storyId: number;
}

export default ({ storyId }: NewPageButtonProps) => {
  const { createPage } = useStoryAtoms();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const createNewPage = async () => {
    try {
      const pageId = await createPage();
      setLocation(getLinkToPagePage(storyId, pageId));
    } catch (error) {
      console.error("Failed to create page:", error);
    }
  };

  return (
    <ButtonContainer>
      <button onClick={() => createNewPage()}>{t.buttons.createPage}</button>
    </ButtonContainer>
  );
};

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 20px;
`;
