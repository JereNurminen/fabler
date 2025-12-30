import { ReactNode } from "react";

export const Card = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-white rounded-lg border border-gray-200 p-3 flex flex-col gap-3 ${className}`}
  >
    {children}
  </div>
);

export const CardTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="text-lg font-bold text-gray-900">{children}</h2>
);

export const CardDescription = ({ children }: { children: ReactNode }) => (
  <p className="text-base text-gray-600">{children}</p>
);

export const CardButtonContainer = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-row items-center justify-between">{children}</div>
);
