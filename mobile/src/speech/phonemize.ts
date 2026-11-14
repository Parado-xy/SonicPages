import { dictionary } from "cmu-pronouncing-dictionary";
import vocabulary from "../vendor/kokoro/vocabulary.json";

const phones: Record<string, string> = {
  AA: "ɑ", AE: "æ", AH: "ʌ", AO: "ɔ", AW: "aʊ", AY: "aɪ", EH: "ɛ", ER: "ɜɹ",
  EY: "eɪ", IH: "ɪ", IY: "i", OW: "oʊ", OY: "ɔɪ", UH: "ʊ", UW: "u",
  B: "b", CH: "ʧ", D: "d", DH: "ð", F: "f", G: "ɡ", HH: "h", JH: "ʤ", K: "k",
  L: "l", M: "m", N: "n", NG: "ŋ", P: "p", R: "ɹ", S: "s", SH: "ʃ", T: "t",
  TH: "θ", V: "v", W: "w", Y: "j", Z: "z", ZH: "ʒ",
};
const fallback: Record<string, string> = {
  ch: "ʧ", sh: "ʃ", th: "θ", ng: "ŋ", ph: "f", a: "æ", c: "k", e: "ɛ",
  g: "ɡ", i: "ɪ", j: "ʤ", o: "ɑ", q: "k", r: "ɹ", u: "ʌ", x: "ks", y: "j",
};
const digits = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

function pronounce(word: string): string {
  if (word === "sonicpages") return "sˈɑnɪk pˈeɪʤɪz";
  const entry = Object.hasOwn(dictionary, word) ? dictionary[word] : undefined;
  if (!entry) {
    return (word.match(/ch|sh|th|ng|ph|[a-z]/g) ?? [])
      .map(letter => fallback[letter] ?? letter).join("");
  }
  return entry.split(" ").map(phone => {
    const stress = phone.at(-1);
    const sound = phone.replace(/[012]$/, "");
    if (stress === "0" && sound === "AH") return "ə";
    if (stress === "0" && sound === "ER") return "əɹ";
    return (stress === "1" ? "ˈ" : stress === "2" ? "ˌ" : "") + (phones[sound] ?? "");
  }).join("");
}

/** American English dictionary lookup with a best-effort fallback for unknown words. */
export function phonemize(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/’/g, "'")
    .replace(/\d+/g, number => [...number].map(digit => digits[Number(digit)]).join(" "))
    .replace(/[a-z]+(?:'[a-z]+)*/g, pronounce)
    .replace(/[^\p{L}\p{M}ˈˌ.,!?;:…—()\s]/gu, " ")
    .replace(/\s+/g, " ").trim();
}

export function kokoroTokens(text: string): number[] {
  const vocab: Record<string, number> = vocabulary;
  const ids = [...phonemize(text)].flatMap(symbol => vocab[symbol] === undefined ? [] : [vocab[symbol]]);
  if (!ids.some(id => id >= 43 && id <= 148)) throw new Error("No supported English speech in this passage");
  if (ids.length > 510) throw new Error("Passage exceeds Kokoro's 510-token limit");
  return [0, ...ids, 0];
}
