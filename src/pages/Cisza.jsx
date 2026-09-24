import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import CiszaChoose from "@/components/exmortis/cisza/CiszaChoose";
import CiszaEntry from "@/components/exmortis/cisza/CiszaEntry";
import CiszaSilence from "@/components/exmortis/cisza/CiszaSilence";
import CiszaReturn from "@/components/exmortis/cisza/CiszaReturn";
import { unlockAudio, useReducedMotion } from "@/components/exmortis/cisza/motion";

const ALLOWED_MIN = [3, 5, 10, 15, 30, 60];
const FALLBACK_SETTINGS = {
  has_voice: false,
  has_music: false,
  intro_url: null,
  outro_url: null,
  background_url: null,
};

// Minutnik ciszy — osobna strona bez logowania.
export default function Cisza() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState("choose");
  const [minutes, setMinutes] = useState(3);
  const [sound, setSound] = useState("cisza");
  const [source, setSource] = useState("");
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const min = Number(params.get("min"));
    if (ALLOWED_MIN.includes(min)) setMinutes(min);
    setSource((params.get("src") || "").slice(0, 100));
    base44.functions
      .invoke("silenceContent", {})
      .then((res) => setSettings(res.data))
      .catch(() => setSettings(FALLBACK_SETTINGS));
  }, []);

  const begin = useCallback(() => {
    unlockAudio();
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    setPhase("entry");
  }, []);

  const recordSession = (completed) => {
    base44.functions
      .invoke("silenceSession", {
        duration_minutes: minutes,
        completed,
        sound_option: sound,
        source,
      })
      .catch(() => {});
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      {phase === "choose" && (
        <CiszaChoose
          minutes={minutes}
          setMinutes={setMinutes}
          sound={sound}
          setSound={setSound}
          settings={settings}
          onStart={begin}
          reduced={reduced}
        />
      )}
      {phase === "entry" && (
        <CiszaEntry
          reduced={reduced}
          introUrl={sound === "glos" && settings?.intro_url ? settings.intro_url : null}
          onDone={() => setPhase("silence")}
        />
      )}
      {phase === "silence" && (
        <CiszaSilence
          minutes={minutes}
          sound={sound}
          source={source}
          backgroundUrl={sound === "muzyka" && settings?.background_url ? settings.background_url : null}
          outroUrl={sound === "glos" && settings?.outro_url ? settings.outro_url : null}
          onEnd={(completed) => {
            recordSession(completed);
            setPhase("return");
          }}
          reduced={reduced}
        />
      )}
      {phase === "return" && <CiszaReturn onAgain={begin} reduced={reduced} />}
    </div>
  );
}