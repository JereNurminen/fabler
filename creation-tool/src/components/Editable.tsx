import { PropsWithChildren, useRef, useState } from "react";
import styled from "styled-components";

interface EditableProps {
  onEdit: (value: string) => void;
  onBlur?: (value: string) => void;
  value: string;
  inputType: 'single-line' | 'multi-line';
}

export const Editable = ({ onEdit, onBlur, value, inputType, children }: PropsWithChildren<EditableProps>) => {
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const onActivate = () => {
    setIsEditing(true)
  }

  if (!isEditing) {
    return <Container onClick={onActivate}>{children}</Container>
  }

  switch (inputType) {
    case 'single-line':
      return (
        <input type='text'
          onBlur={e => {
            setIsEditing(false)
            onBlur?.(e.target.value)
          }}
          onChange={e => onEdit(e.target.value)}
          value={value}
        />
      )
    case 'multi-line':
      return (
        <textarea
          onBlur={e => {
            setIsEditing(false)
            onBlur?.(e.target.value)
          }}
          onChange={e => onEdit(e.target.value)}
          value={value}
        />
      )
  }
}

const Container = styled.div`
display: contents;
`
