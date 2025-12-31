import { TextareaHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, className = "", id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");

    // Label styling
    const labelStyles = clsx(
      "block mb-1",
      "text-sm font-medium",
      "text-gray-700 dark:text-gray-300"
    );

    // Textarea base structure and sizing
    const textareaBase = clsx(
      "w-full px-3 py-2",
      "rounded-md shadow-sm",
      "transition-colors",
      "resize-y min-h-[100px]"
    );

    // Textarea colors and borders (light mode)
    const textareaLight = clsx(
      "bg-white text-gray-900",
      "border border-gray-300"
    );

    // Textarea colors and borders (dark mode)
    const textareaDark = clsx(
      "dark:bg-gray-800 dark:text-gray-100",
      "dark:border-gray-600"
    );

    // Textarea focus states
    const textareaFocus = clsx(
      "focus:outline-none",
      "focus:ring-2 focus:ring-primary",
      "focus:border-primary"
    );

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className={labelStyles}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(textareaBase, textareaLight, textareaDark, textareaFocus, className)}
          {...props}
        />
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
