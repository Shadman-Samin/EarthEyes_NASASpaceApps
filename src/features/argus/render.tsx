import type { ReactNode } from "react"
import { parseArgusText } from "./text"

const inlinePattern = /(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s<>()]+)/g

function trimUrl(url: string) {
  return url.replace(/[.,;:!?]+$/, "")
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  inlinePattern.lastIndex = 0
  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b${match.index}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith("`")) {
      nodes.push(<code key={`${keyPrefix}-c${match.index}`}>{token.slice(1, -1)}</code>)
    } else {
      const href = trimUrl(token)
      nodes.push(<a key={`${keyPrefix}-a${match.index}`} href={href} target="_blank" rel="noreferrer">{href}</a>)
      if (href.length < token.length) nodes.push(token.slice(href.length))
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function ArgusText({ text }: { text: string }) {
  const blocks = parseArgusText(text)
  return (
    <>
      {blocks.map((block, index) => {
        const key = `block-${index}`
        const content = block.items.map((item, itemIndex) => renderInline(item, `${key}-${itemIndex}`))
        if (block.kind === "bullets") return <ul key={key}>{block.items.map((_, itemIndex) => <li key={`${key}-${itemIndex}`}>{content[itemIndex]}</li>)}</ul>
        if (block.kind === "ordered") return <ol key={key}>{block.items.map((_, itemIndex) => <li key={`${key}-${itemIndex}`}>{content[itemIndex]}</li>)}</ol>
        return <p key={key}>{content[0] ?? null}</p>
      })}
    </>
  )
}
