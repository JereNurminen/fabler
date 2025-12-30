import { useStoryAtoms } from "../atoms/useStoryAtoms";
import styled from "styled-components";

export default () => {
  const { createPage } = useStoryAtoms();

  const createNewPage = async () => {
    try {
      await createPage();
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
