// A hover scope holds at most 64 characters, and test names run longer: a row's scope is a short hash of its id.
export const scopeOf = (id: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  return `row:${(h >>> 0).toString(36)}`
}
