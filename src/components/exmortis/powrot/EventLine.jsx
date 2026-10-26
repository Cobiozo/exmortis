import React from "react";

// POWRÓT: stała linia nad przyciskiem kwalifikacyjnym — link do zakładki spotkań.
export default function EventLine() {
  return (
    <p className="text-foreground/60 leading-relaxed">
      Chcesz najpierw zobaczyć, jak pracuję? Weź udział w najbliższym otwartym spotkaniu{" "}
      <a href="https://exmortis.pl/spotkania" className="gold-text hover:underline">
        SPOTKANIA
      </a>
      .
    </p>
  );
}