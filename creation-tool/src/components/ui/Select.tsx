import { SelectHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, className = "", id, children, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

    // Label styling
    const labelStyles = clsx(
      "block mb-1",
      "text-sm font-medium",
      "text-gray-700 dark:text-gray-300"
    );

    // Select base structure and sizing
    const selectBase = clsx(
      "w-full px-3 py-2",
      "rounded-md shadow-sm",
      "transition-colors"
    );

    // Select colors and borders (light mode)
    const selectLight = clsx(
      "bg-white text-gray-900",
      "border border-gray-300"
    );

    // Select colors and borders (dark mode)
    const selectDark = clsx(
      "dark:bg-gray-800 dark:text-gray-100",
      "dark:border-gray-600"
    );

    // Select focus states
    const selectFocus = clsx(
      "focus:outline-none",
      "focus:ring-2 focus:ring-primary",
      "focus:border-primary"
    );

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className={labelStyles}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={clsx(selectBase, selectLight, selectDark, selectFocus, className)}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  }
);

Select.displayName = "Select";
