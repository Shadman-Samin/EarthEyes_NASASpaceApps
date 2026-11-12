# EarthEyes — 60s Showcase Plan (NASA Space Apps 2026: Dancing with SARs)

**Target:** 58–60s video, 16:9 (1920×1080), captured on production `https://eartheyes.vercel.app`.

## 1) Goal & Core Message
- **Problem:** Coastal/flood/ice change is hard to monitor with optical imagery (clouds, darkness).
- **Solution:** EarthEyes is a map-first SAR field atlas that lets anyone load real NASA/ESA acquisitions, compare dates, and interpret evidence responsibly.
- **Proof:** Live Kuakata NISAR browse comparisons + real-time exploratory Summary/Chart/Context + contextual Argus.
- **Takeaway:** Accessible, honest SAR insight for understanding environmental change. URL: `eartheyes.vercel.app`.

## 2) Re-evaluated Narrative (why this fits in 1 min)
- **Single location, single flow:** Stay in Kuakata within `/explore` to avoid context-switching/time loss (no multi-page tour).
- **Show, don’t tour:** Demonstrate 4 key capabilities only—live catalogue load, date comparison (swipe), evidence panel, Argus Q&A.
- **Trust built-in:** Surface “exploratory & uncalibrated” on-screen while showing results (no separate limitations slide).
- **Tight timing:** 6 beats, ~142 spoken words at ~145 wpm (~59s) with natural pauses on key reveals; no dead air.

## 3) Shot-by-Shot Storyboard & Voiceover (58s)
| Time | Beat | Screen action (capture) | On-screen text/callout | Voiceover script |
|---:|---|---|---|---|
| 0:00–0:05 | Hook | Landing hero (`/`) with orbital bg → cursor to **Open the explorer** | `EarthEyes` · `Dancing with SARs` | "Clouds and night can hide change on the coast. With SAR, we can see through—and EarthEyes makes that visible." |
| 0:05–0:14 | Live data | Explorer loads Kuakata; show real NISAR footprints, timeline, auto-selected footprint/pair | `Live NASA NISAR acquisitions` · `Kuakata, Bangladesh` | "In the explorer, we load real NASA NISAR acquisitions over Kuakata, Bangladesh. EarthEyes automatically selects the best footprint and comparable observation dates." |
| 0:14–0:26 | Compare | **Swipe** comparison between selected dates; slow drag, keep SAR overlay/browse visible | `Before / After` · date labels | "Using swipe view, we compare SAR backscatter across those dates. Subtle shifts in water, surface roughness, and structure become easier to spot in the same area." |
| 0:26–0:38 | Evidence | Open Evidence drawer; briefly show **Summary**, **Chart**, **Context** updating | `Computed from pulled records` · `Exploratory & uncalibrated` | "The evidence panel computes summaries and charts in real time from the loaded records and previews. These insights are exploratory and uncalibrated—not direct measurements." |
| 0:38–0:48 | Argus | Open Argus; ask "What changed between these dates?" and show concise answer | `Argus: contextual guide` | "Then we ask Argus what changed between these dates. It responds from the same selected evidence, helping users interpret the signal responsibly." |
| 0:48–0:58 | Close | Gentle zoom-out on map/footprints → end card | `Understand change. Explore responsibly.` · `eartheyes.vercel.app` | "EarthEyes turns complex SAR into accessible evidence for communities and researchers. Explore it live at eartheyes dot vercel dot app." |

## 4) Voiceover Script (recording-ready)

### Full continuous script (~142 words, ~59s @ 145 wpm)
> [0:00–0:05 | Hook] Clouds and night can hide change on the coast. With SAR, we can see through—and EarthEyes makes that visible.
>
> [0:05–0:14 | Live data] In the explorer, we load real NASA NISAR acquisitions over Kuakata, Bangladesh. EarthEyes automatically selects the best footprint and comparable observation dates.
>
> [0:14–0:26 | Compare] Using swipe view, we compare SAR backscatter across those dates. Subtle shifts in water, surface roughness, and structure become easier to spot in the same area.
>
> [0:26–0:38 | Evidence] The evidence panel computes summaries and charts in real time from the loaded records and previews. These insights are exploratory and uncalibrated—not direct measurements.
>
> [0:38–0:48 | Argus] Then we ask Argus what changed between these dates. It responds from the same selected evidence, helping users interpret the signal responsibly.
>
> [0:48–0:58 | Close] EarthEyes turns complex SAR into accessible evidence for communities and researchers. Explore it live at eartheyes dot vercel dot app.

### Delivery & sync notes
- **Pace/tone:** Clear, confident, calm; ~145 wpm. Emphasize: *SAR*, *real NASA NISAR acquisitions*, *exploratory and uncalibrated*, *eartheyes.vercel.app*.
- **Pauses:** Brief pause (~0.3–0.5s) after "see through—" (0:03), before "exploratory and uncalibrated" (0:33), and before the URL (0:55) to let visuals land.
- **Pronunciation:** Kuakata ≈ "koo-AH-kah-tah"; NISAR ≈ "NY-sar"; SAR spelled as letters; say "eartheyes dot vercel dot app" for clarity.
- **Sync cues:** Click **Open the explorer** on "makes that visible"; start swipe drag on "compare SAR backscatter"; open Evidence on "evidence panel computes"; trigger Argus question on "ask Argus"; show end card on URL line.
- **Captioning:** Burn-in captions recommended; keep wording identical to script for accessibility and timing.

## 5) Production Plan
**Pre-record (stage once, saves retakes)**
- **Groq-powered Argus (for the showcase take):** run locally with `npm run dev`; `.env` must contain `VITE_GROQ_API_KEY=<provided Groq key>` and `VITE_GROQ_MODEL=qwen/qwen3.8-27b`. Argus sends Groq the current page URL and loaded explorer context so answers match what is shown. `.env` is gitignored; `VITE_` values are public in client builds.
- Verify Kuakata loads at least 2 comparable NISAR dates and the comparison renders; open Argus once to warm it up.
- Browser 1920x1080, 100% zoom, clean profile (no bookmarks/devtools/notifications), cursor highlight on, and minimal desktop clutter.
- Close heavy apps/tabs for smooth map/WebGL; have the exact question ready: `What changed between these dates?`

**Capture**
- Record screen at 60 fps; move cursor slowly and pause ~1s on key reveals (footprints, mid-swipe, evidence labels, Argus answer).
- Capture system/UI audio off; record VO separately for clarity (~145 wpm, ~140 words total) or use clean burned-in captions.

**Edit (keep minimal)**
- Hard cuts to 58s; subtle zoom/callouts only on dates, swipe handle, and Exploratory & uncalibrated label.
- Light background music optional at low volume under VO; ensure text contrast/readability.
- End card holds 2-3s with live URL.

## 6) On-Screen Accuracy & Compliance Checklist
- [ ] State/show: uses **real acquisitions** and **public browse previews** (NISAR/OPERA context as shown).
- [ ] Keep visible or voiced: insights are **exploratory and uncalibrated** (not georeferenced measurements).
- [ ] Do **not** claim direct sea-level measurement, calibrated hazard extent, or public warning capability.
- [ ] If Groq unavailable, Argus/evidence fallbacks are deterministic; still label outputs as data-based/exploratory.
- [ ] End with working URL: https://eartheyes.vercel.app.

## 7) Fallbacks (if live demo hiccups)
- If catalogue slow: pre-load explorer state before recording; cut waiting time in edit.
- If Argus delayed: capture a successful response take separately and splice (context unchanged).
- If comparison asset fails: switch to another pre-verified date pair in same footprint before final take.
- Last resort: use a clean local run with identical flow, but prefer production URL for credibility.
