import { useState } from "react";
import { useTranslation } from "../../i18n";

interface SelectWithCreateProps {
  label: string;
  id?: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
  onCreate: (name: string) => Promise<{ id: string } | null>;
  createLabel?: string;
  createPlaceholder?: string;
  createPromptLabel?: string;
  placeholder?: string;
}

export function SelectWithCreate({
  label,
  id,
  value,
  options,
  onChange,
  onCreate,
  createLabel,
  createPlaceholder,
  createPromptLabel,
  placeholder,
}: SelectWithCreateProps) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const created = await onCreate(newName.trim());
      if (created) {
        onChange(created.id);
      }
    } catch (err) {
      // `onCreate` is expected to report its own failure (e.g. into the
      // save-status atom) and resolve to `null` rather than reject — this
      // component has no way to know what "failed" means for whatever
      // entity the caller is creating. This catch is a last-resort net for
      // a caller that does not honour that contract; it only logs, so keep
      // every `onCreate` implementation self-reporting.
      console.error("Failed to create:", err);
    }
    setCreating(false);
    setNewName("");
  };

  if (creating) {
    return (
      <div className="space-y-2">
        {createPromptLabel && (
          <label className="block text-sm font-medium text-gray-700">
            {createPromptLabel}
          </label>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              // handleCreate catches its own errors and never rejects; the
              // `.catch` is defensive uniformity for no-floating-promises.
              if (e.key === "Enter") { void handleCreate().catch(() => {}); }
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
            placeholder={createPlaceholder}
            autoFocus
          />
          <button
            onClick={() => { void handleCreate().catch(() => {}); }}
            className="px-2 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            {t.buttons.create}
          </button>
          <button
            onClick={() => { setCreating(false); setNewName(""); }}
            className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            {t.buttons.cancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => {
          if (e.target.value === "__create_new__") {
            setCreating(true);
            return;
          }
          onChange(e.target.value);
        }}
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
        <option value="__create_new__">+ {createLabel || t.buttons.create}</option>
      </select>
    </div>
  );
}
