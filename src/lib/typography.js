// Polska typografia przy wyświetlaniu (dane w bazie zostają nietknięte).
// Tekst wklejony z edytora ma często &nbsp; między słowami — przy `overflow-wrap: break-word`
// przeglądarka łamie wtedy wyrazy w środku („Po|trzebuje”). Tu najpierw zwykłe spacje,
// a potem twarda spacja tylko po jednoliterowych spójnikach i przyimkach (sierotki).
const NBSP = "\u00a0";
const ONES = "oOwWzZiIaAuU";
const ORPHAN = new RegExp(`(^|[\\s(„"«])([${ONES}]) `, "g");
const SKIP = /^(PRE|CODE|SCRIPT|STYLE|TEXTAREA)$/;

// Sierotki: „i słowo” → „i\u00a0słowo”. Dwa przebiegi — po podmianie skan idzie dalej,
// więc ciąg spójników („i w nim”) wymaga drugiego przejścia.
export function orphans(text) {
  const once = (t) => t.replace(ORPHAN, (_, pre, letter) => pre + letter + NBSP);
  return once(once(String(text ?? "")));
}

// Zwykły tekst: twarde spacje na zwykłe, potem sierotki.
export function fixText(text) {
  return orphans(String(text ?? "").replace(/[\u00a0\u202f]/g, " "));
}

// To samo dla HTML — tylko węzły tekstowe, więc znaczniki i atrybuty zostają bez zmian.
export function fixTextNodes(root) {
  if (!root) return root;
  const doc = root.ownerDocument || root;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentNode && SKIP.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((n) => {
    const t = fixText(n.nodeValue);
    if (t !== n.nodeValue) n.nodeValue = t;
  });
  return root;
}