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