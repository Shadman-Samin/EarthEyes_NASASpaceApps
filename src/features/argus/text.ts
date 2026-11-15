export type Block = { kind: "paragraph" | "bullets" | "ordered"; items: string[] }

const bulletPattern = /^\s*[-*•]\s+(.*)$/
const orderedPattern = /^\s*\d+[.)]\s+(.*)$/

export function parseArgusText(text: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", items: [paragraph.join(" ")] })
      paragraph = []
    }
  }
  let list: Block | null = null
  const flushList = () => {
    if (list) {
      blocks.push(list)
      list = null
    }
  }

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }
    const bullet = line.match(bulletPattern)
    if (bullet) {
      flushParagraph()
      if (list?.kind !== "bullets") {
        flushList()
        list = { kind: "bullets", items: [] }
      }
      list.items.push(bullet[1])
      continue
    }
    const ordered = line.match(orderedPattern)
    if (ordered) {
      flushParagraph()
      if (list?.kind !== "ordered") {
        flushList()
        list = { kind: "ordered", items: [] }
      }
      list.items.push(ordered[1])
      continue
    }
    flushList()
    paragraph.push(line.replace(/^#{1,6}\s+/, ""))
  }
  flushParagraph()
  flushList()
  return blocks
}
