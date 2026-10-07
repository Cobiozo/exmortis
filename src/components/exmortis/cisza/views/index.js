import DigitsView from "./DigitsView";
import ClockView from "./ClockView";
import BarView from "./BarView";
import HourglassView from "./HourglassView";
import PortalView from "./PortalView";

export const VIEWS = [
  { id: "cyfry", label: "Cyfry", C: DigitsView },
  { id: "zegar", label: "Zegar", C: ClockView },
  { id: "pasek", label: "Pasek", C: BarView },
  { id: "klepsydra", label: "Klepsydra", C: HourglassView },
  { id: "portal", label: "Portal", C: PortalView },
];

export const DEFAULT_VIEW = "portal";
export const getView = (id) => VIEWS.find((v) => v.id === id) || VIEWS.find((v) => v.id === DEFAULT_VIEW);
export const nextView = (id) => VIEWS[(VIEWS.findIndex((v) => v.id === id) + 1) % VIEWS.length].id;