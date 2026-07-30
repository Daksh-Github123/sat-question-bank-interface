// Repairs stray mid-word spaces that some PDF exports introduce during text
// extraction (e.g. "suppor t" -> "support", "par ticipants" -> "participants",
// "Fur thermore" -> "Furthermore"). The College Board question-bank PDFs drop a
// space around certain glyph pairs (almost always near a "t"), splitting a word
// into two fragments.
//
// The repair is conservative and dictionary-backed so it never merges two
// legitimate words: it only rejoins A + B into AB when AB is an English word and
// at least one of A/B is not a word on its own. Extra guards avoid the known
// false-positive shapes (answer-choice refs like "Choice C is", unit/variable
// letters like "as K", and a lookahead so "for certain" is never turned into
// "forcer tain").

let dictPromise: Promise<Set<string>> | null = null;

async function getDict(): Promise<Set<string>> {
  if (!dictPromise) {
    dictPromise = import("an-array-of-english-words").then((m) => {
      const words = ((m as any).default || m) as string[];
      return new Set(words);
    });
  }
  return dictPromise;
}

const ALPHA = /^[A-Za-z]+$/;

function repairWith(dict: Set<string>, text: string): string {
  if (!text) return text;
  const isWord = (t: string) => dict.has(t.toLowerCase());
  const parts = text.split(" ");
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    let cur = parts[i];
    // Greedy left-to-right merge with chaining. Only pure-alpha tokens merge, so
    // anything with attached punctuation/digits is left alone (safe, conservative).
    while (i + 1 < parts.length) {
      const nxt = parts[i + 1];
      if (!ALPHA.test(cur) || !ALPHA.test(nxt)) break;
      // Never merge a single-letter LEFT token ("Choice C is", "I am").
      if (cur.length < 2) break;
      // Never merge a single UPPERCASE right token (units/variables: "as K").
      if (nxt.length === 1 && /[A-Z]/.test(nxt)) break;
      const joined = cur + nxt;
      if (!isWord(joined)) break;
      // Don't merge two real words ("with out", "how ever" stay as-is).
      if (isWord(cur) && isWord(nxt)) break;
      // Lookahead: if the left is a complete word and the right fragment fits the
      // FOLLOWING token better, leave this space ("for certain", not "forcer tain").
      const following = parts[i + 2];
      if (isWord(cur) && !isWord(nxt) && following && ALPHA.test(following) && isWord(nxt + following)) break;
      cur = joined;
      i++;
    }
    out.push(cur);
  }
  return out.join(" ");
}

/** Returns a synchronous repair function with the dictionary preloaded. */
export async function makeRepairer(): Promise<(text: string) => string> {
  const dict = await getDict();
  return (text: string) => repairWith(dict, text);
}
