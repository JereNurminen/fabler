import { Disclosure, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { ReactNode } from "react";
import { Badge } from "./Badge";

export interface CollapsibleProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export const Collapsible = ({
  title,
  icon: Icon,
  badge,
  defaultOpen = false,
  className,
  children,
}: CollapsibleProps) => {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div className={clsx("border-b border-gray-200", className)}>
          <Disclosure.Button className="flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              {Icon && <Icon className="w-5 h-5 text-gray-600" />}
              <span>{title}</span>
              {badge !== undefined && badge > 0 && (
                <Badge variant="primary">{badge}</Badge>
              )}
            </div>
            <ChevronDownIcon
              className={`w-5 h-5 text-gray-600 transition-transform ${
                open ? "transform rotate-180" : ""
              }`}
            />
          </Disclosure.Button>
          <Transition
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <Disclosure.Panel className="pb-2">{children}</Disclosure.Panel>
          </Transition>
        </div>
      )}
    </Disclosure>
  );
};
