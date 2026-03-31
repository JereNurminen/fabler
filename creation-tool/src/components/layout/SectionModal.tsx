import { ReactNode } from "react";
import { Dialog } from "../ui/Dialog";

interface SectionModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export const SectionModal = ({
  open,
  onClose,
  title,
  children,
}: SectionModalProps) => {
  return (
    <Dialog open={open} onClose={onClose} title={title} maxWidth="lg">
      <div className="max-h-[70vh] overflow-y-auto">{children}</div>
    </Dialog>
  );
};
