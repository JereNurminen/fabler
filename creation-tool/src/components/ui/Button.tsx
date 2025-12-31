import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "success";
  size?: "sm" | "md" | "lg";
}

export const Button = ({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) => {
  // Base structure and behavior
  const base = clsx(
    "inline-flex items-center justify-center",
    "rounded-md font-medium",
    "transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-offset-2",
    "disabled:opacity-50 disabled:cursor-not-allowed"
  );

  // Variant-specific colors and styles
  const variants = {
    primary: clsx(
      "bg-primary text-white",
      "hover:bg-blue-600",
      "focus:ring-primary",
      "dark:bg-blue-600 dark:hover:bg-blue-700"
    ),
    secondary: clsx(
      "bg-gray-300 text-gray-900",
      "border border-gray-400",
      "hover:bg-gray-400",
      "focus:ring-gray-400",
      "dark:bg-gray-700 dark:text-gray-100",
      "dark:border-gray-600 dark:hover:bg-gray-600"
    ),
    danger: clsx(
      "bg-danger text-white",
      "hover:bg-red-600",
      "focus:ring-danger"
    ),
    success: clsx(
      "bg-success text-white",
      "hover:bg-green-600",
      "focus:ring-success"
    ),
  };

  // Size-specific spacing and typography
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      className={clsx(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
};

Button.displayName = "Button";
