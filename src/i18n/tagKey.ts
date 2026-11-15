/** Stable ASCII key for a free-text tag. Spaces and hyphens fold; other symbols become u+hex. */
export function tagKey(tag: string): string {
  let out = ''
  for (const ch of tag) {
    if (/[a-zA-Z0-9]/.test(ch)) out += ch
    else if (ch === ' ' || ch === '-' || ch === '_' || ch === '/' || ch === "'" || ch === '’') out += '_'
    else {
      const cp = ch.codePointAt(0) ?? 0
      out += 'u' + cp.toString(16)
    }
  }
  return out.toLowerCase().replace(/_+/g, '_').replace(/^_|_$/g, '') || 'tag'
}

/** Hyphenated trait slugs become words. ALL-CAPS tokens stay as written (`DOS-risk` → `DOS risk`). */
export function humanizeTrait(slug: string): string {
  return slug.replace(/-/g, ' ')
}
