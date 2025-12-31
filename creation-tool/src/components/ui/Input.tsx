import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    // Label styling
    const labelStyles = clsx(
      "block mb-1",
      "text-sm font-medium",
      "text-gray-700 dark:text-gray-300"
    );

    // Input base structure and sizing
    const inputBase = clsx(
      "w-full px-3 py-2",
      "rounded-md shadow-sm",
      "transition-colors"
    );

    // Input colors and borders (light mode)
    const inputLight = clsx(
      "bg-white text-gray-900",
      "border border-gray-300"
    );

    // Input colors and borders (dark mode)
    const inputDark = clsx(
      "dark:bg-gray-800 dark:text-gray-100",
      "dark:border-gray-600"
    );

    // Input focus states
    const inputFocus = clsx(
      "focus:outline-none",
      "focus:ring-2 focus:ring-primary",
      "focus:border-primary"
    );

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={labelStyles}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(inputBase, inputLight, inputDark, inputFocus, className)}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";
