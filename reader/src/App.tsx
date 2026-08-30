import { useState } from "react";
import { LibraryScreen } from "./screens/LibraryScreen";
import { PlayerScreen } from "./screens/PlayerScreen";
import type { InstalledStory } from "@fabler/types";

type Screen =
  | { type: "library" }
  | { type: "player"; story: InstalledStory };

export function App() {
  const [screen, setScreen] = useState<Screen>({ type: "library" });

  if (screen.type === "player") {
    return (
      <PlayerScreen
        story={screen.story}
        onBack={() => setScreen({ type: "library" })}
      />
    );
  }

  return (
    <LibraryScreen
      onPlay={(story) => setScreen({ type: "player", story })}
    />
  );
}
