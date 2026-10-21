// Surowy klient platformy (przeniesiony z base44Client.js bez zmian).
// Cały dostęp do niego przechodzi przez adapter w ./exmAdapter.

import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { readConsent } from '@/components/legal/cookieStore';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Analityka Base44 działa dopiero po zgodzie na cookies „Analityczne” (od następnego wczytania strony).
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  appBaseUrl,
  analytics: { enabled: readConsent()?.analytics === true }
});

// Bez zgody analitycznej nie zostawiamy identyfikatora sesji platformy w pamięci przeglądarki.
if (readConsent()?.analytics !== true) {
  const drop = () => localStorage.removeItem("base44_analytics_session_id");
  drop(); setTimeout(drop, 0); window.addEventListener("load", drop, { once: true });
}