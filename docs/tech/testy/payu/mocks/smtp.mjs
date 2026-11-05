export const mails = globalThis.__mails || (globalThis.__mails = []);
export async function sendMail(_b, m) { mails.push({ kind: m.kind, to: m.to, subject: m.subject }); return true; }
export async function adminTo() { return "admin@test.invalid"; }
export function orderEmailHtml() { return ""; }
export function campaignEmailHtml() { return ""; }
