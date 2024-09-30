import { useState } from "react";
import { useStoryContext } from "../StoryContext";
import styled from "styled-components";

type Props = {};

export default () => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const { createPage } = useStoryContext();

  const onAccept = async () => {
    const id = await createPage(name);
    console.debug("Created page with id", id);
    setIsOpen(false);
    setName("");
  };

  return (
    <ButtonContainer>
      <Button onClick={() => setIsOpen(true)}>Add Page</Button>
      {isOpen && (
        <NameInputContainer>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <AcceptButton onClick={onAccept}>Accept</AcceptButton>
          <CancelButton onClick={() => setIsOpen(false)}>Cancel</CancelButton>
        </NameInputContainer>
      )}
    </ButtonContainer>
  );
};

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 20px;
`;

const Button = styled.button``;

const NameInputContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: repeat(2, auto);
  border-radius: 5px;
  box-shadow: 0 0 5px 0 rgba(0, 0, 0, 0.2);
`;

const NameInputButton = styled.button`
  border: none;
  background-color: #f0f0f0;
  padding: 10px;
  border-radius: 5px;
  cursor: pointer;
`;

const AcceptButton = styled(NameInputButton)`
  background-color: #00ff00;
`;

const CancelButton = styled(NameInputButton)`
  background-color: #ff0000;
`;
