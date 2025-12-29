import { useState } from "react";
import styled from "styled-components";
import { Card } from "./Card";
//import { theme } from "../style";

export const NewStoryDialog = ({
  onConfirm,
  onCancel,
}: {
  onConfirm: (title: string) => void;
  onCancel: () => void;
}) => {
  const [title, setTitle] = useState("");

  return (
    <Overlay>
      <Card>
        <SingleLineInput
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />
        <ButtonContainer>
          <button
            onClick={() => {
              onConfirm(title);
            }}
          >
            Create
          </button>
          <button onClick={onCancel}>Cancel</button>
        </ButtonContainer>
      </Card>
    </Overlay>
  );
};

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: space-between;
`;

const Overlay = styled.div`
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;

  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  background-color: rgba(0, 0, 0, 0.5);
`;

const SingleLineInput = styled.input`
  border: 1px solid #000;
  border-radius: 2px;
`;
