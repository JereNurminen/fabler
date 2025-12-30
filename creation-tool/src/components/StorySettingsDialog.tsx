import { useState } from "react";
import styled from "styled-components";
import { Card } from "./Card";

type StorySettingsDialogProps = {
  storyId: number;
  initialTitle: string;
  initialStartPage: number | null;
  pages: Array<{ id: number; name: string }>;
  onConfirm: (title: string, startPage: number) => void;
  onCancel: () => void;
};

export const StorySettingsDialog = ({
  storyId,
  initialTitle,
  initialStartPage,
  pages,
  onConfirm,
  onCancel,
}: StorySettingsDialogProps) => {
  const [title, setTitle] = useState(initialTitle);
  const [startPage, setStartPage] = useState<number>(
    initialStartPage ?? pages[0]?.id ?? 0
  );

  const handleConfirm = () => {
    if (title.trim() === "") {
      alert("Story title cannot be empty");
      return;
    }
    if (!startPage) {
      alert("Please select a start page");
      return;
    }
    onConfirm(title, startPage);
  };

  return (
    <Overlay onClick={onCancel}>
      <DialogCard onClick={(e) => e.stopPropagation()}>
        <Title>Story Settings</Title>

        <Label>Story Title</Label>
        <SingleLineInput
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Story title"
          autoFocus
        />

        <Label>Start Page</Label>
        <Select
          value={startPage}
          onChange={(e) => setStartPage(Number(e.target.value))}
        >
          {pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.name || `Page ${page.id}`}
            </option>
          ))}
        </Select>

        <ButtonContainer>
          <ConfirmButton onClick={handleConfirm}>Save</ConfirmButton>
          <CancelButton onClick={onCancel}>Cancel</CancelButton>
        </ButtonContainer>
      </DialogCard>
    </Overlay>
  );
};

// Styled Components
const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const DialogCard = styled(Card)`
  min-width: 400px;
  max-width: 500px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: ${(props) => props.theme.fg};
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: ${(props) => props.theme.fg};
  margin-top: 8px;
`;

const SingleLineInput = styled.input`
  padding: 8px 12px;
  border: 1px solid ${(props) => props.theme.border};
  border-radius: 4px;
  background-color: ${(props) => props.theme.bg};
  color: ${(props) => props.theme.fg};
  font-size: 14px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.primary};
  }
`;

const Select = styled.select`
  padding: 8px 12px;
  border: 1px solid ${(props) => props.theme.border};
  border-radius: 4px;
  background-color: ${(props) => props.theme.bg};
  color: ${(props) => props.theme.fg};
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.primary};
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 8px;
`;

const Button = styled.button`
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
`;

const ConfirmButton = styled(Button)`
  background-color: ${(props) => props.theme.primary};
  color: white;
`;

const CancelButton = styled(Button)`
  background-color: ${(props) => props.theme.border};
  color: ${(props) => props.theme.fg};
`;
