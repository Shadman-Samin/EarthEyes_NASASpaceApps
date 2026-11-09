import { useEffect, useState, type FormEvent } from "react"
import * as Tabs from "@radix-ui/react-tabs"
import { useAlerts } from "../../data/queries"
import { formatDateTime } from "../../shared/formatting"
import { Button, DataBadge, Icon, Skeleton, StatePanel } from "../../shared/ui"
import type { Alert } from "../../domain/models"
import { getDataOrigin } from "../../data/repository"

export function GroundLinePage() {
  const alertsQuery = useAlerts()
  const fixtureData = getDataOrigin() === "fixture"
  const [selectedId, setSelectedId] = useState("")
  const [formState, setFormState] = useState<"idle" | "otp" | "confirmed">("idle")
  const [status, setStatus] = useState("")
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])
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
      setStatus("Enter a phone number in international E.164 format, beginning with + and country code.")
      return
    }
    setFormState("otp")
    setStatus("Demo OTP step opened. No phone number was transmitted or stored.")
  }

  return (
    <main id="main-content" className="groundline-page">
      <header className="groundline-hero"><div><span className="section-kicker section-kicker--light">GroundLine / Pixels to people</span><h1>Warnings should reach the whole village.</h1><p>A case study for authority-issued SMS and voice notices that work without a smartphone, while keeping automated detection behind human and institutional safety gates.</p><div><span>No app required</span><span>SMS + voice</span><span>Local language ready</span></div></div><aside><Icon name="shield" size={27} /><strong>Operational boundary</strong><p>EarthEyes can prioritize review. Public messages require validated thresholds, supporting evidence, and responsible authority approval.</p></aside></header>

      <section className="warning-workflow" aria-labelledby="workflow-title"><header><span className="section-kicker">Safety workflow</span><h2 id="workflow-title">No automatic jump from pixel to public alert.</h2></header><ol><li><span>01</span>Automated threshold</li><li><span>02</span>Analyst review</li><li><span>03</span>Supporting evidence</li><li><span>04</span>Authority approval</li><li><span>05</span>SMS / voice delivery</li></ol></section>

      {alertsQuery.isLoading ? <Skeleton lines={8} /> : alertsQuery.isError ? <StatePanel title="Alert feed unavailable" message="GroundLine records could not be loaded." icon="alert" /> : (
        <Tabs.Root defaultValue="public" className="groundline-workspace">
          <Tabs.List aria-label="GroundLine views"><Tabs.Trigger value="public">Public notices</Tabs.Trigger><Tabs.Trigger value="review">Review candidates</Tabs.Trigger><Tabs.Trigger value="subscribe">Subscription demo</Tabs.Trigger></Tabs.List>
          <Tabs.Content value="public">
            <div className="alert-layout"><aside className="alert-feed"><header><span className="live-dot live-dot--authority" /> Current authority-issued {fixtureData ? "demo " : ""}records</header>{authorityAlerts.length ? authorityAlerts.map((alert) => <button key={alert.id} type="button" aria-pressed={selected?.id === alert.id} onClick={() => setSelectedId(alert.id)}><span>{alert.severity}</span><strong>{alert.title}</strong><small>{alert.area} / expires {formatDateTime(alert.expiresAt)}</small></button>) : <StatePanel compact title="No active notices" message="No currently effective authority-issued records are available." />}{expiredCount > 0 && <p className="alert-feed__archive">{expiredCount} expired record{expiredCount === 1 ? "" : "s"} excluded from the public feed.</p>}</aside>{selected && <AlertDetail alert={selected} onPreview={(message) => setStatus(message)} />}</div>
          </Tabs.Content>
          <Tabs.Content value="review"><div className="review-candidates"><div className="review-candidates__warning"><Icon name="alert" size={20} /><div><strong>Internal review only</strong><p>These records must not appear in a public alert feed or trigger delivery.</p></div></div>{reviewCandidates.map((alert) => <article key={alert.id}><div><DataBadge value="interpretation" /><span>{alert.status.replace("-", " ")}</span></div><h3>{alert.title}</h3><p>{alert.instruction}</p><small>{alert.area} / {alert.authority}</small></article>)}</div></Tabs.Content>
          <Tabs.Content value="subscribe">
            <div className="subscription-layout"><section><span className="section-kicker">Preference demo</span><h2>Receive authority-approved notices.</h2><p>Choose an area and delivery channel. This prototype demonstrates consent, OTP, preference, and unsubscribe states without transmitting data.</p><ul><li>International phone formatting</li><li>SMS, voice, or both</li><li>Area and language preferences</li><li>Explicit consent and easy unsubscribe</li></ul></section><form onSubmit={subscribe} className="subscription-form"><label><span>Phone number / E.164</span><input type="tel" name="phone" autoComplete="tel" placeholder="+8801712345678" required /></label><div><label><span>Area</span><select name="area" defaultValue="barishal"><option value="barishal">Barishal demo area</option><option value="patuakhali">Patuakhali demo area</option><option value="imja">Imja review area</option></select></label><label><span>Language</span><select name="language" defaultValue="bn"><option value="bn">Bangla</option><option value="en">English</option><option value="ne">Nepali</option></select></label></div><fieldset><legend>Delivery</legend><label><input type="radio" name="delivery" value="sms" /> SMS</label><label><input type="radio" name="delivery" value="voice" /> Voice</label><label><input type="radio" name="delivery" value="both" defaultChecked /> Both</label></fieldset><label className="consent"><input type="checkbox" required /> <span>I consent to this interface demonstration. I understand no registration is created.</span></label>{formState === "otp" && <label><span>Demo verification code</span><input inputMode="numeric" pattern="[0-9]{6}" placeholder="000000" onChange={(event) => { if (/^\d{6}$/.test(event.target.value)) { setFormState("confirmed"); setStatus("Demo preferences confirmed locally. Nothing was stored.") } }} /></label>}{formState === "confirmed" ? <div className="subscription-confirmed"><Icon name="check" size={17} /> Demo preferences confirmed <button type="button" onClick={() => { setFormState("idle"); setStatus("Demo subscription removed.") }}>Unsubscribe</button></div> : <Button type="submit">Continue to OTP demo</Button>}<small>No message is sent. No phone number is stored.</small></form></div>
          </Tabs.Content>
        </Tabs.Root>
      )}
      {status && <div className="toast" role="status">{status}<button type="button" aria-label="Dismiss message" onClick={() => setStatus("")}><Icon name="close" size={14} /></button></div>}
    </main>
  )
}

function AlertDetail({ alert, onPreview }: { alert: Alert; onPreview: (message: string) => void }) {
  return (
    <article className="alert-detail"><header><div><DataBadge value="authority-alert" /><span>{alert.severity}</span></div><h2>{alert.title}</h2><p>{alert.area}</p></header><dl><div><dt>Issued</dt><dd>{formatDateTime(alert.issuedAt)}</dd></div><div><dt>Certainty</dt><dd>{alert.certainty}</dd></div><div><dt>Urgency</dt><dd>{alert.urgency}</dd></div><div><dt>Expires</dt><dd>{formatDateTime(alert.expiresAt)}</dd></div><div><dt>Authority</dt><dd>{alert.authority}</dd></div></dl><section><span>SMS preview</span><p>{alert.smsPreview}</p></section><section><span>Voice preview</span><p>{alert.voicePreview}</p><button type="button" onClick={() => onPreview("Voice preview text is ready. Audio delivery is not connected in this prototype.")}><Icon name="play" size={15} /> Preview voice state</button></section><div className="alert-detail__instruction"><Icon name="shield" size={18} /><div><strong>Instruction</strong><p>{alert.instruction}</p></div></div></article>
  )
}
