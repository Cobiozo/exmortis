import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Save, Trash2, CreditCard, Mail } from "lucide-react";
import AppUrlSettings from "./AppUrlSettings";
import { useAuth } from "@/lib/AuthContext";
import { ACTIVE_BACKEND } from "@/api/exmAdapter";

const inputCls =
  "w-full bg-transparent border hairline px-4 py-2.5 focus:border-[#C9A24A] focus:outline-none transition-colors text-sm";
const labelCls = "technical text-[10px] text-foreground/50 block mb-2";

const EMPTY_PAYU = { posId: "", clientId: "", clientSecret: "", secondKey: "", env: "secure" };
const EMPTY_SMTP = { host: "", port: "", user: "", password: "", from: "" };

function Msg({ msg }) {
  if (!msg) return null;
  return <p className={`text-sm mt-3 ${msg.ok ? "gold-text" : "blood-text"}`}>{msg.text}</p>;
}

function Text({ label, value, onChange, placeholder = "", type = "text" }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type={type}
        value={value || ""}
        placeholder={placeholder}
        onChange={onChange}
        className={inputCls}
      />
    </div>
  );
}

export default function IntegrationsManager() {
  const { user } = useAuth();
  // Klucze PayU zmienia wyłącznie administrator — rola „techniczna" nie widzi tego formularza.
  const isAdmin = user?.role === "admin";
  const [payu, setPayu] = useState(EMPTY_PAYU);
  const [smtp, setSmtp] = useState(EMPTY_SMTP);
  const [loading, setLoading] = useState(true);
  const [appUrl, setAppUrl] = useState("");
  const [payuBusy, setPayuBusy] = useState(false);
  const [smtpBusy, setSmtpBusy] = useState(false);
  const [payuMsg, setPayuMsg] = useState(null);
  const [smtpMsg, setSmtpMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  // Adres powiadomień liczy serwer zależnie od wdrożenia (Base44 albo funkcja edge Supabase) —
  // panel nie zgaduje go z adresu strony.
  const [notifyUrl, setNotifyUrl] = useState("");
  const [backend, setBackend] = useState(ACTIVE_BACKEND);
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState(null);

  const load = () =>
    base44.functions
      .invoke("adminSettings", { action: "get" })
      .then((res) => {
        setPayu({ ...EMPTY_PAYU, ...(res.data.payu || {}) });
        setSmtp({ ...EMPTY_SMTP, ...(res.data.smtp || {}) });
        setAppUrl(res.data.app?.url || "");
        setNotifyUrl(res.data.notifyUrl || "");
        setBackend(res.data.backend || ACTIVE_BACKEND);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const errText = (err, fallback) => err?.response?.data?.error || fallback;

  const save = async (target, data, setBusy, setMsg) => {
    setBusy(true);
    setMsg(null);
    try {
      await base44.functions.invoke("adminSettings", { action: "save", target, data });
      setMsg({ ok: true, text: "Zapisano." });
      load();
    } catch (err) {
      setMsg({ ok: false, text: errText(err, "Nie udało się zapisać.") });
    } finally {
      setBusy(false);
    }
  };

  const clearData = async (target, setBusy, setMsg) => {
    if (!window.confirm("Usunąć zapisane dane tej integracji?")) return;
    setBusy(true);
    setMsg(null);
    try {
      await base44.functions.invoke("adminSettings", { action: "delete", target });
      setMsg({ ok: true, text: "Dane usunięte." });
      load();
    } catch (err) {
      setMsg({ ok: false, text: errText(err, "Nie udało się usunąć.") });
    } finally {
      setBusy(false);
    }
  };

  // Test autoryzacji OAuth na zapisanych danych — sekrety nie opuszczają serwera.
  const testPayu = async () => {
    setTestBusy(true);
    setTestMsg(null);
    try {
      const res = await base44.functions.invoke("adminSettings", { action: "payu_test" });
      setTestMsg({
        ok: true,
        text: `Połączenie z PayU działa (${res.data.env === "sandbox" ? "środowisko testowe" : "produkcja"}).`,
      });
    } catch (err) {
      setTestMsg({ ok: false, text: errText(err, "Nie udało się zalogować do PayU.") });
    } finally {
      setTestBusy(false);
    }
  };

  const copyNotify = async () => {
    try {
      await navigator.clipboard.writeText(notifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Skopiuj adres powiadomień:", notifyUrl);
    }
  };

  if (loading) {
    return <div className="h-64 border hairline animate-pulse bg-[#0F0F10]" />;
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      <AppUrlSettings initial={appUrl} />
      {/* ===== PAYU ===== */}
      {isAdmin && (
      <section className="border hairline p-6 md:p-8">
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="h-5 w-5 gold-text" />
          <h2 className="relic-heading text-xl">Płatności PayU</h2>
        </div>
        <p className="text-sm text-foreground/50 mb-6 leading-relaxed">
          Dane z panelu PayU (payu.com). Gdy integracja jest uzupełniona, kasa automatycznie
          kieruje kupujących do płatności online.
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          <Text
            label="POS ID"
            value={payu.posId}
            onChange={(e) => setPayu({ ...payu, posId: e.target.value })}
          />
          <Text
            label="CLIENT ID"
            value={payu.clientId}
            onChange={(e) => setPayu({ ...payu, clientId: e.target.value })}
          />
          <Text
            label="CLIENT SECRET"
            type="password"
            value={payu.clientSecret}
            onChange={(e) => setPayu({ ...payu, clientSecret: e.target.value })}
          />
          <Text
            label="DRUGI KLUCZ"
            type="password"
            value={payu.secondKey}
            onChange={(e) => setPayu({ ...payu, secondKey: e.target.value })}
          />
          <div>
            <label className={labelCls}>ŚRODOWISKO</label>
            <select
              value={payu.env || "secure"}
              onChange={(e) => setPayu({ ...payu, env: e.target.value })}
              className={`${inputCls} bg-[#0A0A0B]`}
            >
              <option value="secure">Produkcja (secure.payu.com)</option>
              <option value="sandbox">Testowe (sandbox)</option>
            </select>
          </div>
        </div>
        <p className="technical text-[9px] text-foreground/40 mt-5 leading-relaxed">
          KLUCZE SĄ MASKOWANE — ZOSTAW BEZ ZMIAN, ABY UTRZYMAĆ ZAPISANE.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="technical text-[9px] text-foreground/40">
            ADRES POWIADOMIEŃ DO PANELU PAYU{backend ? ` (${backend === "supabase" ? "SUPABASE EDGE" : backend === "base44" ? "BASE44" : backend})` : ""}:
          </span>
          {notifyUrl ? (
            <>
              <span className="technical text-[10px] gold-text break-all">{notifyUrl}</span>
              <button
                type="button"
                onClick={copyNotify}
                className="btn-ghost !px-3 !py-1.5 !text-[10px]"
              >
                {copied ? "SKOPIOWANO" : "KOPIUJ"}
              </button>
            </>
          ) : (
            <span className="technical text-[10px] text-foreground/40">ADRES NIEZNANY — SPRAWDŹ KONFIGURACJĘ WDROŻENIA</span>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-6">
          <button
            onClick={() => save("payu", payu, setPayuBusy, setPayuMsg)}
            disabled={payuBusy}
            className="btn-relic !px-5 !py-2.5 disabled:opacity-60"
          >
            {payuBusy ? "ZAPISUJĘ..." : "ZAPISZ"} {!payuBusy && <Save className="h-4 w-4" />}
          </button>
          <button
            onClick={() => clearData("payu", setPayuBusy, setPayuMsg)}
            disabled={payuBusy}
            className="btn-ghost !px-5 !py-2.5 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" /> USUŃ DANE
          </button>
          <button
            type="button"
            onClick={testPayu}
            disabled={testBusy}
            className="btn-ghost !px-5 !py-2.5 disabled:opacity-60"
          >
            {testBusy ? "ŁĄCZĘ..." : "TESTUJ POŁĄCZENIE"}
          </button>
        </div>
        <Msg msg={payuMsg} />
        <Msg msg={testMsg} />
      </section>
      )}

      <section className="border hairline p-6 md:p-8">
        <div className="flex items-center gap-3 mb-2">
          <Mail className="h-5 w-5 gold-text" />
          <h2 className="relic-heading text-xl">Poczta</h2>
        </div>
        <p className="text-sm text-foreground/50">
          Konfiguracja przeniesiona: <a href="/admin/ustawienia" className="gold-text underline">Ustawienia → Wysyłka e-mail</a>.
        </p>
      </section>
    </div>
  );
}