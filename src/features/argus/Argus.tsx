import * as Dialog from "@radix-ui/react-dialog"
import { useEffect, useRef, useState } from "react"
import { Icon } from "../../shared/ui"
import { useMediaQuery } from "../../shared/useMediaQuery"
import { answerArgus, type ArgusContext, type ChatMessage } from "./answers"

export function Argus({ context }: { context: ArgusContext }) {
  const mobile = useMediaQuery("(max-width: 719px)")
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const contextKey = JSON.stringify(context)
  const [conversation, setConversation] = useState({ key: contextKey, messages: [] as ChatMessage[], pending: false })
  const messages = conversation.key === contextKey ? conversation.messages : []
  const pending = conversation.key === contextKey && conversation.pending
  const launcherRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    requestRef.current?.abort()
    return () => requestRef.current?.abort()
  }, [contextKey])
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages.length, pending, open])

  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => launcherRef.current?.focus())
  }
  const ask = async (value: string) => {
    const prompt = value.trim().slice(0, 600)
    if (!prompt || pending) return
    const controller = new AbortController()
    requestRef.current?.abort()
    requestRef.current = controller
    setConversation({ key: contextKey, messages: [...messages.slice(-18), { role: "user", text: prompt }], pending: true })
    setQuestion("")
    inputRef.current?.focus()
    try {
      const answer = await answerArgus(prompt, context, messages, controller.signal)
      if (!controller.signal.aborted) setConversation((current) => current.key !== contextKey ? current : { ...current, messages: [...current.messages, { role: "assistant", ...answer }], pending: false })
    } catch {
      if (!controller.signal.aborted) setConversation((current) => current.key !== contextKey ? current : { ...current, messages: [...current.messages, { role: "assistant", text: "The answer is unavailable. Please try again.", source: "data" }], pending: false })
    }
  }

  const launcher = <button ref={launcherRef} type="button" className="argus-launcher" aria-label="Ask Argus evidence guide" aria-expanded={open} aria-controls={open ? "argus-panel" : undefined} hidden={open} onClick={() => setOpen(true)}><Icon name="chat" size={19} /> Argus</button>
  const content = <>
    <header className="argus__header"><div><strong>Argus</strong><small>Ask about this view</small></div><button type="button" onClick={close} aria-label="Close Argus"><Icon name="close" size={18} /></button></header>
    <div className="argus__context"><span>{context.catalogueStatus === "loading" ? "Loading acquisitions..." : context.catalogueStatus === "error" ? "Catalogue unavailable" : `${context.view.acquisitionCount} loaded / ${context.acquisitions.length} in this footprint`}</span>{context.view.sourceUrl?.startsWith("https://") && <a href={context.view.sourceUrl} target="_blank" rel="noreferrer">Source <Icon name="external" size={12} /></a>}</div>
    <div ref={logRef} className="argus__messages" role="log" aria-live="polite" aria-label="Argus conversation" tabIndex={0}>
      {!messages.length && <p className="argus__intro">Ask about the selected dates, radar data or computed change.</p>}
      {messages.map((message, index) => <div key={index} className={`argus__message argus__message--${message.role}`}><p>{message.text}</p>{message.source && <small>{message.source === "groq" ? "AI / current data" : "From loaded data"}</small>}</div>)}
      {pending && <p className="argus__pending" role="status">Reading the current data...</p>}
    </div>
    {!messages.length && <div className="argus__prompts">{["Summarize", "What changed?", "Limits"].map((prompt) => <button key={prompt} type="button" onClick={() => { void ask(prompt) }}>{prompt}</button>)}</div>}
    <form className="argus__compose" onSubmit={(event) => { event.preventDefault(); void ask(question) }}><input ref={inputRef} autoFocus aria-label="Ask about this view" placeholder="Ask about this view..." value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={600} required autoComplete="off" /><button type="submit" aria-label="Send question" disabled={pending || !question.trim()}><Icon name="arrow" size={18} /></button></form>
    <footer className="argus__footer">Exploratory preview data. Not a warning.</footer>
  </>

  if (mobile) return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger asChild>{launcher}</Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content id="argus-panel" className="argus argus--mobile" data-comparison={context.comparison.status} aria-describedby="argus-description" onOpenAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus() }}><Dialog.Title className="sr-only">Argus evidence guide</Dialog.Title><Dialog.Description id="argus-description" className="sr-only">Questions about the currently loaded explorer data.</Dialog.Description>{content}</Dialog.Content></Dialog.Portal></Dialog.Root>
  return <>{launcher}{open && <aside id="argus-panel" className="argus" data-comparison={context.comparison.status} aria-label="Argus evidence guide" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close() } }}>{content}</aside>}</>
}
