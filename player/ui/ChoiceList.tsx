import type { Choice } from "../engine/types";

interface ChoiceListProps {
  choices: Choice[];
  onChoose: (choice: Choice) => void;
}

export function ChoiceList({ choices, onChoose }: ChoiceListProps) {
  if (choices.length === 0) {
    return (
      <footer
        className="max-w-prose mx-auto mt-[2em] pt-[1em]"
        style={{ borderTop: "1px solid var(--player-border)" }}
      >
        <p
          className="text-center italic"
          style={{ color: "var(--player-text-muted)" }}
        >
          The End
        </p>
      </footer>
    );
  }

  return (
    <nav
      aria-label="Story choices"
      className="max-w-prose mx-auto mt-[2em] pt-[1em]"
      style={{ borderTop: "1px solid var(--player-border)" }}
    >
      <ul className="list-none p-0 m-0 flex flex-col gap-[0.75em]">
        {choices.map((choice) => (
          <li key={choice.id}>
            <button
              onClick={() => onChoose(choice)}
              className="w-full text-left p-[1em] rounded-lg cursor-pointer
                         transition-colors duration-150 border
                         min-h-[44px]"
              style={{
                backgroundColor: "var(--player-choice-bg)",
                borderColor: "var(--player-choice-border)",
                color: "var(--player-choice-text)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--player-choice-bg-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--player-choice-bg)")
              }
            >
              {choice.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
