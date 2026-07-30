// Free, keyless English dictionary lookup (dictionaryapi.dev), called from the
// browser when a term is saved to the vocabulary bank. Single words resolve to a
// definition (and sometimes an example sentence); phrases / proper nouns 404,
// in which case we return nulls and let the user fill the meaning in later.

export interface DictionaryResult {
  definition: string | null;
  example: string | null;
}

export async function lookup(term: string): Promise<DictionaryResult> {
  const word = term.trim();
  // The API only handles single tokens; skip the request for phrases.
  if (!word || /\s/.test(word)) return { definition: null, example: null };
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (!res.ok) return { definition: null, example: null };
    const data = await res.json();
    // Shape: [{ meanings: [{ definitions: [{ definition, example }] }] }]
    const meanings = Array.isArray(data) ? data[0]?.meanings ?? [] : [];
    for (const m of meanings) {
      for (const d of m?.definitions ?? []) {
        if (d?.definition) {
          return { definition: d.definition, example: d.example ?? null };
        }
      }
    }
    return { definition: null, example: null };
  } catch {
    return { definition: null, example: null };
  }
}
