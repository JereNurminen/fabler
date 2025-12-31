import { Dialog as HeadlessDialog, Transition } from "@headlessui/react";
import { Fragment, ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export const Dialog = ({
  open,
  onClose,
  title,
  children,
  maxWidth = "md",
}: DialogProps) => {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };

  // Backdrop styling
  const backdrop = "fixed inset-0 bg-black/25";

  // Container for centering
  const container = clsx(
    "fixed inset-0 overflow-y-auto"
  );

  const centerWrapper = clsx(
    "flex min-h-full items-center justify-center p-4",
    "text-center"
  );

  // Dialog panel base structure
  const panelBase = clsx(
    "w-full transform overflow-hidden",
    "rounded-lg p-6",
    "text-left align-middle",
    "shadow-xl transition-all"
  );

  // Dialog panel colors (light mode)
  const panelLight = "bg-white";

  // Dialog panel colors (dark mode)
  const panelDark = "dark:bg-gray-800";

  // Title header container
  const titleHeader = clsx(
    "flex items-center justify-between mb-4"
  );

  // Title text styling
  const titleText = clsx(
    "text-lg font-semibold",
    "text-gray-900 dark:text-gray-100"
  );

  // Close button styling
  const closeButton = clsx(
    "text-gray-400",
    "hover:text-gray-600 dark:hover:text-gray-300",
    "transition-colors"
  );

  return (
    <Transition appear show={open} as={Fragment}>
      <HeadlessDialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className={backdrop} />
        </Transition.Child>

        <div className={container}>
          <div className={centerWrapper}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <HeadlessDialog.Panel
                className={clsx(panelBase, panelLight, panelDark, maxWidthClasses[maxWidth])}
              >
                {title && (
                  <div className={titleHeader}>
                    <HeadlessDialog.Title as="h3" className={titleText}>
                      {title}
                    </HeadlessDialog.Title>
                    <button onClick={onClose} className={closeButton}>
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                )}
                {children}
              </HeadlessDialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </HeadlessDialog>
    </Transition>
  );
};
