// Proporcje kadru zdjęć (klasy Tailwind jako literały).
export const RATIO = {
  "1:1": "aspect-square", "4:5": "aspect-[4/5]", "3:2": "aspect-[3/2]", "16:9": "aspect-video", "21:9": "aspect-[21/9]",
  "4:3": "aspect-[4/3]", "2:3": "aspect-[2/3]",
};
export const KADRY = ["1:1", "4:5", "2:3", "3:2", "16:9", "21:9"];
// Kadr zapisany w zdjęciu bloku ma pierwszeństwo przed proporcją bloku.
export const ratioClass = (img, fallback) => RATIO[img?.kadr] || RATIO[fallback] || "aspect-video";
// Liczbowa proporcja (szerokość / wysokość) — do ograniczenia wysokości zdjęć.
export const RATIO_NUM = { "1:1": 1, "4:5": 0.8, "3:2": 1.5, "16:9": 16 / 9, "21:9": 21 / 9, "4:3": 4 / 3, "2:3": 2 / 3 };
// Zdjęcie nie wyższe niż ~72% ekranu (maks. 720 px): szerokość ograniczona tak, by zachować kadr.
// Na telefonie (wąski ekran) nic się nie zmienia — tam ogranicza szerokość ekranu.
export const MAX_IMG_H = "min(72svh, 720px)";
export const fitStyle = (img, fallback) => {
  const r = RATIO_NUM[img?.kadr] || RATIO_NUM[fallback] || 16 / 9;
  return { maxWidth: `min(100%, calc(${MAX_IMG_H} * ${r.toFixed(4)}))` };
};
