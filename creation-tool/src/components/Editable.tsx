import { PropsWithChildren, useState } from "react";

interface EditableProps {
  onEdit: (value: string) => void;
  onBlur?: (value: string) => void;
  value: string;
  inputType: "single-line" | "multi-line";
}

export const Editable = ({
  onEdit,
  onBlur,
  value,
  inputType,
  children,
}: PropsWithChildren<EditableProps>) => {
  const [isEditing, setIsEditing] = useState(false);

  const onActivate = () => {
    setIsEditing(true);
  };

  if (!isEditing) {
    return <div onClick={onActivate} className="contents">{children}</div>;
  }

  switch (inputType) {
    case "single-line":
      return (
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded"
          onBlur={(e) => {
            setIsEditing(false);
            onBlur?.(e.target.value);
          }}
          onChange={(e) => onEdit(e.target.value)}
          value={value}
        />
      );
    case "multi-line":
      return (
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded"
          onBlur={(e) => {
            setIsEditing(false);
            onBlur?.(e.target.value);
          }}
          onChange={(e) => onEdit(e.target.value)}
          value={value}
        />
      );
  }
};
