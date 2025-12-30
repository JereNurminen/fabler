import { useStoryAtoms } from "../atoms/useStoryAtoms";
import styled from "styled-components";
import { useLocation } from "wouter";
import { getLinkToPagePage } from "../utilities/routing";

interface NewPageButtonProps {
  storyId: number;
}

export default ({ storyId }: NewPageButtonProps) => {
  const { createPage } = useStoryAtoms();
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
      <button onClick={() => createNewPage()}>Create Page</button>
    </ButtonContainer>
  );
};

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 20px;
`;
