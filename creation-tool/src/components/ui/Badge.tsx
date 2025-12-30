import { HTMLAttributes } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "success" | "danger";
}

export const Badge = ({ variant = "default", className = "", children, ...props }: BadgeProps) => {
  const variantClasses = {
    default: "bg-gray-200 text-gray-900",
    primary: "bg-primary text-white",
    success: "bg-success text-white",
    danger: "bg-danger text-white",
  };

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
