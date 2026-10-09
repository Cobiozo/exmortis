import { base44 } from "@/api/base44Client";

export const ann = (action, data = {}) => base44.functions.invoke("announcements", { action, ...data }).then((r) => r.data);
export const KIND_LABEL = { ogloszenie: "OGŁOSZENIE", zaproszenie: "ZAPROSZENIE", przypomnienie: "PRZYPOMNIENIE" };
// Zdarzenie dla kropki przy ikonie konta.
export const ANN_SEEN = "exm:ann-seen";