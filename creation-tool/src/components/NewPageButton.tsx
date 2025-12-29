import { useStoryContext } from "../StoryContext";
import styled from "styled-components";

type Props = {};

export default () => {
  const { createPage } = useStoryContext();

  const createNewPage = async () => {
    await createPage();
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
