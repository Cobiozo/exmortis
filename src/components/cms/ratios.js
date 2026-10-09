// Proporcje kadru zdjęć (klasy Tailwind jako literały).
export const RATIO = {
  "1:1": "aspect-square", "4:5": "aspect-[4/5]", "3:2": "aspect-[3/2]", "16:9": "aspect-video", "21:9": "aspect-[21/9]",
  "4:3": "aspect-[4/3]",
};
export const KADRY = ["1:1", "4:5", "3:2", "16:9", "21:9"];
// Kadr zapisany w zdjęciu bloku ma pierwszeństwo przed proporcją bloku.
export const ratioClass = (img, fallback) => RATIO[img?.kadr] || RATIO[fallback] || "aspect-video";