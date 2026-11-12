import { useEffect, useRef, useState, type FormEvent } from "react"
import * as Tabs from "@radix-ui/react-tabs"
import { useAlerts } from "../../data/queries"
import { formatDateTime } from "../../shared/formatting"
import { Button, DataBadge, Icon, Skeleton, StatePanel } from "../../shared/ui"
import type { Alert } from "../../domain/models"
import { getDataOrigin } from "../../data/repository"

const gates = [
  ["Automated threshold", "Flag a signal for investigation, not public action."],
  ["Analyst review", "Check the source, quality and alternative explanations."],
  ["Supporting evidence", "Corroborate with field reports and independent records."],
  ["Authority approval", "A responsible authority decides whether to issue a notice."],
  ["SMS / voice delivery", "Only approved messages may enter a real delivery system."],
]

export function GroundLinePage() {
  const alertsQuery = useAlerts()
  const fixtureData = getDataOrigin() === "fixture"
  const [selectedId, setSelectedId] = useState("")
  const [formState, setFormState] = useState<"idle" | "otp" | "confirmed">("idle")
  const [phoneError, setPhoneError] = useState("")
  const [status, setStatus] = useState("")
  const [now, setNow] = useState(() => Date.now())
  const phoneInput = useRef<HTMLInputElement>(null)
  const codeInput = useRef<HTMLInputElement>(null)
  const confirmation = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])
  useEffect(() => {
    if (formState === "otp") codeInput.current?.focus()
    if (formState === "confirmed") confirmation.current?.focus()
  }, [formState])

  const authorityAlerts = alertsQuery.data?.filter((alert) =>
    alert.status === "authority-issued" &&
    new Date(alert.issuedAt).getTime() <= now &&
    new Date(alert.expiresAt).getTime() > now,
  ) ?? []
  const reviewCandidates = alertsQuery.data?.filter((alert) =>
    ["candidate", "analyst-review"].includes(alert.status) && new Date(alert.expiresAt).getTime() > now,
  ) ?? []
  const expiredCount = alertsQuery.data?.filter((alert) =>
    alert.status === "expired" || new Date(alert.expiresAt).getTime() <= now,
  ).length ?? 0
  const selected = authorityAlerts.find((alert) => alert.id === selectedId) ?? authorityAlerts[0]

  const subscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const phone = String(form.get("phone") ?? "")
    if (!/^\+[1-9]\d{7,14}$/.test(phone.replace(/[\s-]/g, ""))) {
      setPhoneError("Enter a phone number in international E.164 format, beginning with + and country code.")
      phoneInput.current?.focus()
      return
    }
    setPhoneError("")
    if (formState === "otp") {
      if (!/^\d{6}$/.test(String(form.get("otp") ?? ""))) return
      setFormState("confirmed")
      setStatus("Demo preferences confirmed locally. Nothing was transmitted or stored.")
    } else {
      setFormState("otp")
      setStatus("Demo OTP step opened. No phone number was transmitted or stored.")
    }
  }

  return (
    <main id="main-content" className="editorial-page groundline-page">
      <header className="groundline-hero">
        <div><span className="section-kicker section-kicker--light">GroundLine / Communication, with accountability</span><h1>Before a warning,<br /><em>a chain of trust.</em></h1><p>What would it take to move from a satellite signal to an authority-approved notice? Explore the review gates, then try a local interface simulation.</p></div>
        <aside className="groundline-demo" role="note" aria-label="GroundLine demonstration"><Icon name="shield" size={28} /><strong>Demonstration, not a warning service.</strong><p>No messages are sent. No phone numbers or preferences are transmitted or stored. Do not use these records for safety decisions.</p></aside>
      </header>
      <section className="warning-workflow editorial-section" aria-labelledby="workflow-title">
        <header className="section-heading"><div><span className="section-kicker">01 / The safety gate</span><h2 id="workflow-title">Five stages.<br />No shortcuts.</h2></div><p>Automated detection can prioritize review. It cannot establish the cause of a change, its downstream consequence, or the instructions a community should follow.</p></header>
        <ol>{gates.map(([title, detail], index) => <li key={title}><span className="step-number">0{index + 1}</span><h3>{title}</h3><p>{detail}</p></li>)}</ol>
      </section>
      <div className="editorial-body">
        <header className="section-heading"><div><span className="section-kicker">02 / Try the interface</span><h2>Inspect a notice.<br /><em>Keep review separate.</em></h2></div><p>The public-notice view accepts only currently effective authority-issued statuses. Candidates and expired records stay out of it. All delivery controls below are simulated.</p></header>
        {alertsQuery.isLoading ? <Skeleton lines={8} /> : alertsQuery.isError ? <StatePanel title="Alert feed unavailable" message="GroundLine records could not be loaded." icon="alert" /> : (
          <Tabs.Root defaultValue="public" className="groundline-workspace">
            <Tabs.List aria-label="GroundLine views"><Tabs.Trigger value="public">Public notices</Tabs.Trigger><Tabs.Trigger value="review">Review candidates</Tabs.Trigger><Tabs.Trigger value="subscribe">Subscription demo</Tabs.Trigger></Tabs.List>
            <Tabs.Content value="public">
              <div className="alert-layout">
                <aside className="alert-feed" aria-label="Available notice records"><header><Icon name="book" size={18} /><span>{fixtureData ? "Authority-issued demo records" : "Authority-status repository records"}</span></header>{authorityAlerts.length ? authorityAlerts.map((alert) => <button key={alert.id} type="button" aria-pressed={selected?.id === alert.id} onClick={() => setSelectedId(alert.id)}><span>{alert.severity} / Demo record</span><strong>{alert.title}</strong><small>{alert.area}<br />Expires {formatDateTime(alert.expiresAt)}</small></button>) : <StatePanel compact title="No active notices" message="No currently effective authority-issued records are available." />}{expiredCount > 0 && <p className="alert-feed__archive">{expiredCount} expired record{expiredCount === 1 ? "" : "s"} excluded from this view.</p>}</aside>
                {selected && <AlertDetail alert={selected} onPreview={setStatus} />}
              </div>
            </Tabs.Content>
            <Tabs.Content value="review">
              <div className="review-candidates">
                <div className="review-candidates__warning"><Icon name="alert" size={22} /><div><h2>Internal review only</h2><p>These records must not appear in a public alert feed or trigger delivery.</p></div></div>
                {reviewCandidates.length ? reviewCandidates.map((alert) => <article key={alert.id}><div><DataBadge value="interpretation" /><span className="eyebrow">{alert.status.replace("-", " ")}</span></div><h3>{alert.title}</h3><p>{alert.instruction}</p><dl className="metadata-list"><div><dt>Area</dt><dd>{alert.area}</dd></div><div><dt>Authority state</dt><dd>{alert.authority}</dd></div></dl></article>) : <StatePanel compact title="No current candidates" message="No unexpired candidate or analyst-review records are available." />}
              </div>
            </Tabs.Content>
            <Tabs.Content value="subscribe">
              <div className="subscription-layout">
                <section><span className="section-kicker">Local simulation</span><h2>Try the steps.<br />Not the service.</h2><p>Use a made-up number to try formatting, consent and a simulated verification code. Area, language and delivery selections are interface preferences only.</p><p>No translations, SMS, audio, account or subscription are created. The language selector does not translate these English previews.</p></section>
                <form onSubmit={subscribe} className="subscription-form" aria-label="Local subscription demo">
                  <label htmlFor="demo-phone">Phone number / E.164</label>
                  <input ref={phoneInput} id="demo-phone" type="tel" name="phone" autoComplete="off" placeholder="+15555550123" required aria-invalid={Boolean(phoneError)} aria-describedby={phoneError ? "demo-phone-error" : "demo-phone-hint"} />
                  <p id="demo-phone-hint" className="form-hint">Include + and a country code. Use a made-up number.</p>
                  {phoneError && <p id="demo-phone-error" className="form-error" role="alert">{phoneError}</p>}
                  <div className="subscription-form__fields"><label><span>Area</span><select name="area" defaultValue="barishal"><option value="barishal">Barishal demo area</option><option value="patuakhali">Patuakhali demo area</option><option value="imja">Imja review area</option></select></label><label><span>Language</span><select name="language" defaultValue="bn"><option value="bn">Bangla</option><option value="en">English</option><option value="ne">Nepali</option></select></label></div>
                  <fieldset><legend>Delivery</legend><label><input type="radio" name="delivery" value="sms" /> SMS</label><label><input type="radio" name="delivery" value="voice" /> Voice</label><label><input type="radio" name="delivery" value="both" defaultChecked /> Both</label></fieldset>
                  <label className="consent"><input type="checkbox" required /> <span>I consent to this interface demonstration. I understand no registration is created.</span></label>
                  {formState === "otp" && <div className="subscription-form__code"><label htmlFor="demo-otp">Demo verification code</label><input ref={codeInput} id="demo-otp" name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required aria-describedby="demo-code-hint" /><p id="demo-code-hint" className="form-hint">Any six digits work in this local simulation. No code is sent.</p></div>}
                  {formState === "confirmed" ? <div ref={confirmation} tabIndex={-1} className="subscription-confirmed"><Icon name="check" size={20} /><strong>Demo preferences confirmed</strong><button type="button" onClick={() => { setFormState("idle"); setStatus("Demo unsubscribed. No registration existed and nothing was stored."); phoneInput.current?.focus() }}>Unsubscribe demo</button></div> : <Button type="submit">{formState === "otp" ? "Confirm demo code" : "Try verification"}</Button>}
                  <p className="form-hint">No data is transmitted or stored by this form.</p>
                </form>
              </div>
            </Tabs.Content>
          </Tabs.Root>
        )}
      </div>
      {status && <div className="toast" role="status">{status}<button type="button" aria-label="Dismiss message" onClick={() => setStatus("")}><Icon name="close" size={16} /></button></div>}
    </main>
  )
}

function AlertDetail({ alert, onPreview }: { alert: Alert; onPreview: (message: string) => void }) {
  return (
    <article className="alert-detail">
      <header><span className="eyebrow">Demonstration / Authority-issued status</span><h2>{alert.title}</h2><p>{alert.area}</p></header>
      <dl className="metadata-list"><div><dt>Authority</dt><dd>{alert.authority}</dd></div><div><dt>Issued</dt><dd>{formatDateTime(alert.issuedAt)}</dd></div><div><dt>Expires</dt><dd>{formatDateTime(alert.expiresAt)}</dd></div><div><dt>Assessment</dt><dd>{alert.severity} severity / {alert.certainty} / {alert.urgency}</dd></div></dl>
      <div className="notice-previews"><section><h3>SMS preview</h3><p>{alert.smsPreview}</p></section><section><h3>Voice preview</h3><p>{alert.voicePreview}</p><button type="button" onClick={() => onPreview("Voice preview text is ready. Audio delivery is not connected in this prototype.")}><Icon name="play" size={16} /> Preview voice state</button></section></div>
      <div className="alert-detail__instruction"><Icon name="shield" size={20} /><div><strong>Instruction in the demo record</strong><p>{alert.instruction}</p></div></div>
    </article>
  )
}
