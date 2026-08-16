// Given a block of text and a set of underlined text spans (captured from the
// source PDF), return the character ranges in `text` to underline. Matching is
// done on an alphanumeric-only normalization so differences in spacing and
// punctuation between the PDF capture and the stored text don't break it.

function normalize(s: string): { out: string; map: number[] } {
  let out = "";
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i].toLowerCase();
    if ((c >= "a" && c <= "z") || (c >= "0" && c <= "9")) {
      out += c;
      map.push(i);
    }
  }
  return { out, map };
}

export function underlineRanges(text: string, spans: string[] | null | undefined): [number, number][] {
  if (!spans || spans.length === 0) return [];
  const { out, map } = normalize(text);
  const ranges: [number, number][] = [];
  for (const span of spans) {
    const ns = normalize(span).out;
    if (ns.length < 3) continue;
    const idx = out.indexOf(ns);
    if (idx === -1) continue;
    ranges.push([map[idx], map[idx + ns.length - 1] + 1]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}
