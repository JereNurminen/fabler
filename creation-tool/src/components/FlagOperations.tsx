import { FlagRuleList } from "./FlagRuleList";
import { useTranslation } from "../i18n";
import type { Flag, FlagOperation } from "../types";

type FlagOperationsProps = {
  operations: FlagOperation[];
  availableFlags: Flag[];
  onAdd: (flagId: string, operation: string) => void;
  onRemove: (flagId: string) => void;
  onCreateFlag?: (name: string) => Promise<{ id: string } | null>;
};

/** Adapter: stored as `{flag_id, operation}`, edited as `{flag_id, value}`. */
export const FlagOperations = ({
  operations,
  availableFlags,
  onAdd,
  onRemove,
  onCreateFlag,
}: FlagOperationsProps) => {
  const { t } = useTranslation();
  return (
    <FlagRuleList
      rules={operations.map((op) => ({ flag_id: op.flag_id, value: op.operation }))}
      availableFlags={availableFlags}
      valueOptions={[
        { value: "set_true" as const, label: t.operations.set_true },
        { value: "set_false" as const, label: t.operations.set_false },
        { value: "toggle" as const, label: t.operations.toggle },
      ]}
      onAdd={onAdd}
      onRemove={onRemove}
      onCreateFlag={onCreateFlag}
      addLabel={t.buttons.addOperation}
      valueLabel={t.labels.operation}
      connector={" → "}
    />
  );
};
