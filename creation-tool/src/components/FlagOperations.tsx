import { useState } from "react";
import { Button } from "./ui/Button";
import { useTranslation } from "../i18n";
import type { Flag, FlagOperation } from "../bindings";

type FlagOperationsProps = {
  operations: FlagOperation[];
  availableFlags: Flag[];
  onAdd: (flagId: number, operation: string) => void;
  onRemove: (flagId: number) => void;
};

export const FlagOperations = ({ operations, availableFlags, onAdd, onRemove }: FlagOperationsProps) => {
  const { t } = useTranslation();
  const [selectedFlagId, setSelectedFlagId] = useState<number | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<string>("set_true");

  const handleAdd = () => {
    if (selectedFlagId === null) return;
    onAdd(selectedFlagId, selectedOperation);
    setSelectedFlagId(null);
  };

  // Filter out flags that already have operations
  const usedFlagIds = new Set(operations.map((op) => op.flag_id));
  const availableForAdd = availableFlags.filter((flag) => !usedFlagIds.has(flag.id));

  return (
    <div className="flex flex-col gap-2">
      {operations.length === 0 ? (
        <div className="py-3 text-center text-gray-500 text-xs italic">
          {t.emptyStates.noOperations}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {operations.map((op) => {
            const flag = availableFlags.find((f) => f.id === op.flag_id);
            return (
              <div
                key={op.id}
                className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs"
              >
                <span className="text-gray-900">
                  <strong>{flag?.name || t.dynamic.flagFallback(op.flag_id)}</strong>
                  {" → "}
                  <span className="font-mono bg-gray-200 px-1.5 py-0.5 rounded text-xs">
                    {t.operations[op.operation as keyof typeof t.operations] ?? op.operation}
                  </span>
                </span>
                <button
                  onClick={() => onRemove(op.flag_id)}
                  aria-label={`Remove ${flag?.name ?? "operation"}`}
                  className="text-danger text-xl w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {availableForAdd.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mt-1">
          <select
            aria-label={t.labels.flag}
            className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded bg-white text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            value={selectedFlagId ?? ""}
            onChange={(e) => setSelectedFlagId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t.labels.flag}...</option>
            {availableForAdd.map((flag) => (
              <option key={flag.id} value={flag.id}>
                {flag.name}
              </option>
            ))}
          </select>

          <select
            aria-label={t.labels.operation}
            className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded bg-white text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            value={selectedOperation}
            onChange={(e) => setSelectedOperation(e.target.value)}
          >
            <option value="set_true">{t.operations.set_true}</option>
            <option value="set_false">{t.operations.set_false}</option>
            <option value="toggle">{t.operations.toggle}</option>
          </select>

          <Button
            onClick={handleAdd}
            disabled={selectedFlagId === null}
            size="sm"
            className="whitespace-nowrap"
          >
            {t.buttons.addOperation}
          </Button>
        </div>
      )}
    </div>
  );
};
