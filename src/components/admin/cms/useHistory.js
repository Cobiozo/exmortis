import { useCallback, useEffect, useRef, useState } from "react";

// Stan bloków z Cofnij/Ponów (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) w obrębie sesji edycji.
export default function useHistory(initial) {
  const [state, setState] = useState(initial);
  const past = useRef([]);
  const future = useRef([]);

  const set = useCallback((next) => {
    setState((cur) => {
      const v = typeof next === "function" ? next(cur) : next;
      past.current = [...past.current.slice(-99), cur];
      future.current = [];
      return v;
    });
  }, []);
  const undo = useCallback(() => setState((cur) => {
    if (!past.current.length) return cur;
    future.current = [cur, ...future.current];
    return past.current.pop();
  }), []);
  const redo = useCallback(() => setState((cur) => {
    if (!future.current.length) return cur;
    past.current = [...past.current, cur];
    return future.current.shift();
  }), []);

  useEffect(() => {
    const on = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      if (e.target.closest?.(".ql-editor, input, textarea")) return;
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [undo, redo]);

  return [state, set, undo, redo];
}