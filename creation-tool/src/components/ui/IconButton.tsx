import { ButtonHTMLAttributes, forwardRef } from "react";
import { Badge } from "./Badge";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  label: string; // For accessibility
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, badge, label, className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`relative p-3 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${className}`}
        aria-label={label}
        title={label}
        {...props}
      >
        <Icon className="w-6 h-6" />
        {badge !== undefined && badge > 0 && (
          <Badge
            variant="primary"
            className="absolute -top-1 -right-1 min-w-[1.25rem] h-5"
          >
            {badge}
          </Badge>
        )}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
