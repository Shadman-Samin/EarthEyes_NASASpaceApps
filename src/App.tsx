import { createElement, useMemo, useState } from "react";

type IconName =
  | "globe"
  | "layers"
  | "calendar"
  | "pin"
  | "chevron"
  | "download"
  | "info"
  | "scan"
  | "trend"
  | "snow"
  | "water"
  | "menu"
  | "chat"
  | "send"
  | "close";

const glacierImage =
  "https://images.unsplash.com/photo-1707646628387-c8f4e6b005c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=85&w=1800";

const seaImage =
  "https://images.unsplash.com/photo-1576158113061-2039f9670880?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=85&w=1800";

const dataByLocation: Record<
  string,
  { ice: string; level: string; rate: string; melt: number; thermal: number; other: number }
> = {
  "Greenland Ice Sheet": {
    ice: "−4,890",
    level: "+14.2",
    rate: "−3.1%",
    melt: 52,
    thermal: 37,
    other: 11,
  },
  Antarctica: {
    ice: "−3,120",
    level: "+9.8",
    rate: "−2.6%",
    melt: 46,
    thermal: 41,
    other: 13,
  },
  "Himalayan Region": {
    ice: "−1,460",
    level: "+4.1",
    rate: "−1.9%",
    melt: 39,
    thermal: 45,
    other: 16,
  },
  "Alaska, United States": {
    ice: "−2,270",
    level: "+6.7",
    rate: "−2.3%",
    melt: 44,
    thermal: 42,
    other: 14,
  },
  "All monitored regions": {
    ice: "−11,740",
    level: "+34.8",
    rate: "−2.8%",
    melt: 49,
    thermal: 39,
    other: 12,
  },
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3-9 5 9 5 9-5-9-5Z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    chevron: <path d="m8 10 4 4 4-4" />,
    download: (
      <>
        <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    scan: (
      <>
        <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    trend: (
      <>
        <path d="m4 17 5-5 4 3 7-8" />
        <path d="M15 7h5v5" />
      </>
    ),
    snow: (
      <>
        <path d="M12 2v20M4 7l16 10M4 17 20 7M8 4l4 3 4-3M8 20l4-3 4 3" />
      </>
    ),
    water: <path d="M12 3S5 11 5 16a7 7 0 0 0 14 0c0-5-7-13-7-13Z" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    chat: (
      <>
        <path d="M20 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4Z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    close: <path d="M6 6l12 12M18 6 6 18" />,
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      {paths[name]}
    </svg>
  );
}

function Pressable({
  children,
  className,
  onClick,
  label,
}: {
  children: React.ReactNode;
  className: string;
  onClick?: () => void;
  label?: string;
}) {
  return createElement(
    "button",
    { className, onClick, type: "button", "aria-label": label },
    children,
  );
}

function SelectField({
  value,
  onChange,
  children,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return createElement(
    "select",
    {
      value,
      onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value),
      className:
        "w-full appearance-none rounded-xl border border-line bg-panel px-4 py-3 pr-9 text-sm font-medium text-ink outline-none transition focus:border-accent",
      "aria-label": ariaLabel,
    },
    children,
  );
}

function FieldLabel({ children, icon }: { children: React.ReactNode; icon: IconName }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
      <Icon name={icon} size={14} />
      {children}
    </div>
  );
}

function InfoPage({
  type,
  onExplore,
}: {
  type: "methodology" | "data";
  onExplore: () => void;
}) {
  const methodology = type === "methodology";
  const steps = [
    {
      number: "01",
      title: "Acquire observations",
      copy: "Radar scenes from Sentinel-1 and NASA-supported archives are grouped by orbit, footprint and acquisition date.",
    },
    {
      number: "02",
      title: "Calibrate & align",
      copy: "Backscatter is radiometrically calibrated, terrain-corrected and co-registered against a common elevation reference.",
    },
    {
      number: "03",
      title: "Detect change",
      copy: "Feature tracking and interferometric signals estimate ice velocity, displacement and changes in grounded ice extent.",
    },
    {
      number: "04",
      title: "Model impact",
      copy: "Mass-balance estimates are converted to global mean sea-level equivalent and combined with altimetry observations.",
    },
  ];

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="grid gap-8 lg:grid-cols-[1.3fr_.7fr] lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-accent">
            <span className="h-px w-6 bg-accent" />
            {methodology ? "How it works" : "Data catalogue"}
          </div>
          <div role="heading" aria-level={1} className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-brand sm:text-5xl">
            {methodology
              ? "From radar echoes to planetary evidence."
              : "Open observations, carefully interpreted."}
          </div>
          <div className="mt-4 max-w-2xl text-base leading-7 text-muted">
            {methodology
              ? "Eyes of Argus turns repeat satellite observations into comparable measurements of ice motion, mass change and sea-level contribution."
              : "Understand the missions, coverage, update cadence and limits behind every visualization in Eyes of Argus."}
          </div>
        </div>
        <div className="rounded-2xl bg-brand p-5 text-white">
          <div className="text-xs font-bold uppercase tracking-wider text-accent-light">
            Scientific principle
          </div>
          <div className="mt-3 font-display text-xl font-semibold">
            Measurements before predictions
          </div>
          <div className="mt-2 text-sm leading-6 text-white/70">
            Displayed values distinguish direct observations from modeled estimates and retain source, date and uncertainty context.
          </div>
        </div>
      </div>

      {methodology ? (
        <>
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="rounded-2xl border border-line bg-panel p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <div className="font-display text-sm font-semibold text-accent">{step.number}</div>
                  <Icon name={step.number === "04" ? "trend" : "scan"} size={18} />
                </div>
                <div role="heading" aria-level={2} className="mt-8 font-display text-lg font-semibold text-brand">
                  {step.title}
                </div>
                <div className="mt-2 text-sm leading-6 text-muted">{step.copy}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-panel p-6 shadow-card">
              <div role="heading" aria-level={2} className="font-display text-xl font-semibold text-brand">
                Sea-level attribution
              </div>
              <div className="mt-3 text-sm leading-6 text-muted">
                Land-ice contribution is calculated from changes in glacier and ice-sheet mass. Ocean thermal expansion is derived from temperature and steric-height products. Terrestrial water storage and remaining factors are grouped separately so the totals remain legible.
              </div>
              <div className="mt-6 space-y-4">
                {[
                  ["Land ice", "GRACE / GRACE-FO mass anomaly"],
                  ["Ocean warming", "Satellite altimetry + Argo profiles"],
                  ["Other factors", "Hydrology and model residual"],
                ].map(([label, source]) => (
                  <div key={label} className="flex items-center justify-between gap-4 border-t border-line pt-4 text-sm">
                    <div className="font-semibold text-brand">{label}</div>
                    <div className="text-right text-muted">{source}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-panel p-6 shadow-card">
              <div role="heading" aria-level={2} className="font-display text-xl font-semibold text-brand">
                Known limitations
              </div>
              <div className="mt-3 text-sm leading-6 text-muted">
                Radar is powerful in darkness and cloud, but interpretation still depends on terrain, orbit geometry and surface conditions.
              </div>
              <div className="mt-5 space-y-3">
                {[
                  "Steep mountain terrain can create radar shadow and layover.",
                  "Short comparison windows may reflect seasonal rather than climatic change.",
                  "Sea-level equivalents describe a global mean, not local coastal water level.",
                  "Recent observations may be revised as higher-quality orbital solutions arrive.",
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-xl bg-canvas p-3 text-sm leading-5 text-ink">
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-accent" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              ["Sentinel-1 SAR", "Ice velocity & extent", "6–12 day revisit", "2014—present"],
              ["GRACE / GRACE-FO", "Ice mass change", "Monthly", "2002—present"],
              ["Satellite altimetry", "Sea-surface height", "10 day composite", "1993—present"],
            ].map(([name, purpose, cadence, coverage]) => (
              <div key={name} className="rounded-2xl border border-line bg-panel p-5 shadow-card">
                <div className="mb-6 flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon name={name.includes("altimetry") ? "water" : "scan"} />
                </div>
                <div role="heading" aria-level={2} className="font-display text-lg font-semibold text-brand">{name}</div>
                <div className="mt-1 text-sm text-muted">{purpose}</div>
                <div className="mt-5 grid grid-cols-2 border-t border-line pt-4 text-xs">
                  <div><span className="block text-muted">Cadence</span><span className="mt-1 block font-semibold text-brand">{cadence}</span></div>
                  <div><span className="block text-muted">Coverage</span><span className="mt-1 block font-semibold text-brand">{coverage}</span></div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
            <div className="border-b border-line p-6">
              <div role="heading" aria-level={2} className="font-display text-xl font-semibold text-brand">Data definitions</div>
              <div className="mt-1 text-sm text-muted">How to read the values shown in the explorer</div>
            </div>
            {[
              ["Ice mass change", "Difference in land-ice mass over the selected period.", "Gigatonnes (Gt)"],
              ["Sea-level equivalent", "Estimated global mean sea-level change represented by the selected ice loss.", "Millimetres (mm)"],
              ["Change rate", "Relative decadal change within the selected observation model.", "Percent per decade"],
              ["SAR observations", "Calibrated radar scenes contributing to the current view.", "Scene count"],
            ].map(([term, definition, unit]) => (
              <div key={term} className="grid gap-2 border-b border-line p-5 last:border-0 md:grid-cols-[1fr_2fr_1fr] md:items-center">
                <div className="font-semibold text-brand">{term}</div>
                <div className="text-sm leading-6 text-muted">{definition}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-accent md:text-right">{unit}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl bg-accent-soft p-6 sm:flex-row sm:items-center">
        <div>
          <div className="font-display text-lg font-semibold text-brand">Ready to inspect the observations?</div>
          <div className="mt-1 text-sm text-muted">Open the explorer and compare any year from 1993 to 2024.</div>
        </div>
        <Pressable className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent" onClick={onExplore}>
          Open explorer
        </Pressable>
      </div>
    </div>
  );
}

function DataAssistant({
  location,
  metric,
}: {
  location: string;
  metric: "ice" | "sea";
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "assistant" | "user"; text: string }>>([
    {
      role: "assistant",
      text: "Hello. I’m Argus AI. Ask me about ice change, sea-level rise, sources, or how to interpret this dashboard.",
    },
  ]);

  const answerQuestion = (question: string) => {
    const query = question.toLowerCase();
    const data = dataByLocation[location];

    if (query.includes("sea") || query.includes("level")) {
      return `${location} has a modeled sea-level equivalent of ${data.level} mm for the displayed comparison. About ${data.melt}% of the attributed rise comes from land-ice melt, ${data.thermal}% from ocean warming, and ${data.other}% from other factors.`;
    }
    if (query.includes("ice") || query.includes("melt") || query.includes("mass")) {
      return `The selected ${location} view shows an estimated ice mass change of ${data.ice} Gt, with a modeled change rate of ${data.rate} per decade. Negative mass values indicate net ice loss.`;
    }
    if (query.includes("source") || query.includes("nasa") || query.includes("data")) {
      return "The experience references Sentinel-1 synthetic aperture radar, NASA-supported ASF DAAC products, GRACE/GRACE-FO gravimetry, satellite altimetry, and Argo ocean profiles. The current interface uses representative prototype values rather than a live scientific data feed.";
    }
    if (query.includes("sar") || query.includes("radar")) {
      return "Synthetic aperture radar measures microwave backscatter and works through cloud cover and polar darkness. Repeat scenes can reveal ice displacement, velocity and changes in surface structure.";
    }
    if (query.includes("compare") || query.includes("year")) {
      return "Choose Compare years to measure change between any two years from 1993–2024. Single year shows the observation model for one year. Longer periods are generally better for separating climate trends from seasonal variability.";
    }
    if (query.includes("mean") || query.includes("interpret") || query.includes("read")) {
      return `You are currently viewing ${metric === "ice" ? "ice change" : "sea-level anomaly"} for ${location}. Cyan marks lower-to-moderate change and warmer highlights mark stronger detected change. Use the legend and annual trend together rather than interpreting a single pixel in isolation.`;
    }
    return `For ${location}, the current summary is ${data.ice} Gt of modeled ice mass change and ${data.level} mm of sea-level equivalent. Ask about ice melt, sea level, SAR, data sources, or year comparisons for more detail.`;
  };

  const sendMessage = (suggestion?: string) => {
    const question = (suggestion ?? draft).trim();
    if (!question) return;
    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "user", text: question },
      { role: "assistant", text: answerQuestion(question) },
    ]);
    setDraft("");
  };

  return (
    <div className="fixed bottom-5 right-4 z-50 flex flex-col items-end sm:bottom-6 sm:right-6">
      {open && (
        <div className="mb-3 flex h-[min(620px,calc(100vh-120px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-chat">
          <div className="flex items-center justify-between bg-brand p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="relative flex size-9 items-center justify-center rounded-xl bg-white/10 text-accent-light">
                <Icon name="chat" size={19} />
                <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-brand bg-success" />
              </div>
              <div>
                <div className="font-display text-sm font-semibold">Argus AI</div>
                <div className="mt-0.5 text-[10px] text-white/60">Earth data assistant</div>
              </div>
            </div>
            <Pressable
              className="flex size-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
              label="Close data assistant"
              onClick={() => setOpen(false)}
            >
              <Icon name="close" size={18} />
            </Pressable>
          </div>

          <div className="border-b border-line bg-accent-soft px-4 py-2 text-[10px] font-semibold text-accent">
            Context: {location} · {metric === "ice" ? "Ice change" : "Sea level"}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${
                    message.role === "user"
                      ? "rounded-br-md bg-brand text-white"
                      : "rounded-bl-md bg-canvas text-ink"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="pt-1">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Suggested questions</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    "What does this ice loss mean?",
                    "What drives sea-level rise?",
                    "Where does the data come from?",
                  ].map((question) => (
                    <Pressable
                      key={question}
                      className="rounded-full border border-line bg-panel px-3 py-2 text-left text-[11px] font-medium text-brand transition hover:border-accent hover:text-accent"
                      onClick={() => sendMessage(question)}
                    >
                      {question}
                    </Pressable>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-line p-3">
            <div className="flex items-end gap-2 rounded-xl border border-line bg-canvas p-1.5 focus-within:border-accent">
              {createElement("input", {
                value: draft,
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
                onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Enter") sendMessage();
                },
                placeholder: "Ask about the data…",
                className: "min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-ink outline-none placeholder:text-muted",
                "aria-label": "Ask Argus AI about the data",
              })}
              <Pressable
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition hover:bg-brand"
                label="Send message"
                onClick={() => sendMessage()}
              >
                <Icon name="send" size={16} />
              </Pressable>
            </div>
            <div className="mt-2 text-center text-[9px] text-muted">Prototype answers may be incomplete. Verify critical findings.</div>
          </div>
        </div>
      )}

      <Pressable
        className="group flex items-center gap-3 rounded-2xl bg-brand p-2.5 pr-4 text-white shadow-chat transition hover:-translate-y-0.5 hover:bg-accent"
        label={open ? "Close Argus AI assistant" : "Open Argus AI assistant"}
        onClick={() => setOpen(!open)}
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-accent-light">
          <Icon name={open ? "close" : "chat"} size={20} />
        </span>
        <span className="text-left">
          <span className="block text-xs font-semibold">Ask Argus AI</span>
          <span className="mt-0.5 block text-[9px] text-white/60">Explore the data</span>
        </span>
      </Pressable>
    </div>
  );
}

function App() {
  const [page, setPage] = useState<"explore" | "methodology" | "data">("explore");
  const [mode, setMode] = useState<"compare" | "single">("compare");
  const [metric, setMetric] = useState<"ice" | "sea">("ice");
  const [location, setLocation] = useState("Greenland Ice Sheet");
  const [startYear, setStartYear] = useState("2002");
  const [endYear, setEndYear] = useState("2024");
  const [layersOpen, setLayersOpen] = useState(false);
  const [mobileControls, setMobileControls] = useState(false);
  const [zoom, setZoom] = useState(1);

  const current = dataByLocation[location];
  const period = mode === "compare" ? `${startYear} — ${endYear}` : endYear;
  const years = Array.from({ length: 32 }, (_, index) => String(1993 + index));
  const chartPoints = useMemo(
    () =>
      metric === "ice"
        ? "0,22 18,25 36,28 54,27 72,35 90,38 108,45 126,43 144,50 162,58 180,64 198,69 216,77 234,83 252,91 270,96 288,105 306,113 324,124"
        : "0,123 18,119 36,116 54,111 72,105 90,101 108,96 126,88 144,82 162,75 180,69 198,62 216,53 234,48 252,39 270,31 288,25 306,16 324,9",
    [metric],
  );

  const option = (value: string) => createElement("option", { value, key: value }, value);

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex size-9 items-center justify-center rounded-full bg-brand text-white shadow-sm">
              <Icon name="globe" size={21} />
              <span className="absolute right-0 top-0 size-2.5 rounded-full border-2 border-panel bg-accent" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold leading-none tracking-tight text-brand">
                Eyes of Argus
              </div>
              <div className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted sm:block">
                Earth observation intelligence
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            {[
              ["explore", "Explore"],
              ["methodology", "Methodology"],
              ["data", "About the data"],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                className={`border-b-2 py-5 text-sm transition ${page === value ? "border-accent font-semibold text-brand" : "border-transparent font-medium text-muted hover:text-brand"}`}
                onClick={() => setPage(value as "explore" | "methodology" | "data")}
              >
                {label}
              </Pressable>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-xs font-semibold text-success sm:flex">
              <span className="size-1.5 rounded-full bg-success" />
              SAR feed active
            </div>
            {page === "explore" && (
              <Pressable
                className="flex size-10 items-center justify-center rounded-xl border border-line bg-panel text-brand md:hidden"
                label="Open observation controls"
                onClick={() => setMobileControls(!mobileControls)}
              >
                <Icon name="menu" />
              </Pressable>
            )}
          </div>
        </div>
      </header>
      <div className="grid grid-cols-3 border-b border-line bg-panel px-3 md:hidden">
        {[
          ["explore", "Explore"],
          ["methodology", "Methodology"],
          ["data", "Data"],
        ].map(([value, label]) => (
          <Pressable
            key={value}
            className={`border-b-2 px-2 py-3 text-xs ${page === value ? "border-accent font-semibold text-brand" : "border-transparent font-medium text-muted"}`}
            onClick={() => setPage(value as "explore" | "methodology" | "data")}
          >
            {label}
          </Pressable>
        ))}
      </div>

      {page === "explore" ? (
      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 lg:py-7">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-accent">
              <span className="h-px w-6 bg-accent" />
              Cryosphere monitor
            </div>
            <div role="heading" aria-level={1} className="font-display text-3xl font-semibold tracking-tight text-brand sm:text-4xl">
              A changing planet, made visible.
            </div>
            <div className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Track ice displacement, mass loss and sea-level impact using processed NASA synthetic aperture radar observations.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-line bg-panel px-4 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Last observation</div>
              <div className="mt-0.5 text-sm font-semibold text-brand">18 Feb 2025 · 06:42 UTC</div>
            </div>
            <Pressable
              className="flex size-11 items-center justify-center rounded-xl border border-line bg-panel text-brand transition hover:border-accent hover:text-accent"
              label="Download current data"
            >
              <Icon name="download" />
            </Pressable>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className={`${mobileControls ? "block" : "hidden"} space-y-4 lg:block`}>
            <div className="rounded-2xl border border-line bg-panel p-4 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <div role="heading" aria-level={2} className="font-display text-lg font-semibold text-brand">
                  Observation settings
                </div>
                <Icon name="scan" size={19} />
              </div>

              <FieldLabel icon="calendar">Observation mode</FieldLabel>
              <div className="mb-5 grid grid-cols-2 rounded-xl bg-canvas p-1">
                <Pressable
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${mode === "compare" ? "bg-panel text-brand shadow-sm" : "text-muted"}`}
                  onClick={() => setMode("compare")}
                >
                  Compare years
                </Pressable>
                <Pressable
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${mode === "single" ? "bg-panel text-brand shadow-sm" : "text-muted"}`}
                  onClick={() => setMode("single")}
                >
                  Single year
                </Pressable>
              </div>

              <FieldLabel icon="layers">Data layer</FieldLabel>
              <div className="mb-5 grid grid-cols-2 gap-2">
                <Pressable
                  className={`rounded-xl border p-3 text-left transition ${metric === "ice" ? "border-accent bg-accent-soft text-brand" : "border-line text-muted hover:border-accent"}`}
                  onClick={() => setMetric("ice")}
                >
                  <Icon name="snow" size={18} />
                  <div className="mt-2 text-xs font-semibold">Ice change</div>
                </Pressable>
                <Pressable
                  className={`rounded-xl border p-3 text-left transition ${metric === "sea" ? "border-accent bg-accent-soft text-brand" : "border-line text-muted hover:border-accent"}`}
                  onClick={() => setMetric("sea")}
                >
                  <Icon name="water" size={18} />
                  <div className="mt-2 text-xs font-semibold">Sea level</div>
                </Pressable>
              </div>

              <FieldLabel icon="pin">Region or country</FieldLabel>
              <div className="relative mb-5">
                <SelectField value={location} onChange={setLocation} ariaLabel="Region or country">
                  {Object.keys(dataByLocation).map(option)}
                </SelectField>
                <div className="pointer-events-none absolute right-3 top-3.5 text-muted"><Icon name="chevron" size={16} /></div>
              </div>

              <FieldLabel icon="calendar">{mode === "compare" ? "Comparison period" : "Observation year"}</FieldLabel>
              <div className={`grid gap-2 ${mode === "compare" ? "grid-cols-[1fr_auto_1fr]" : "grid-cols-1"}`}>
                {mode === "compare" && (
                  <>
                    <div className="relative">
                      <SelectField value={startYear} onChange={setStartYear} ariaLabel="Start year">
                        {years.slice(0, -1).map(option)}
                      </SelectField>
                      <div className="pointer-events-none absolute right-2 top-3.5 text-muted"><Icon name="chevron" size={15} /></div>
                    </div>
                    <div className="self-center text-xs text-muted">to</div>
                  </>
                )}
                <div className="relative">
                  <SelectField value={endYear} onChange={setEndYear} ariaLabel="End year">
                    {years.map(option)}
                  </SelectField>
                  <div className="pointer-events-none absolute right-2 top-3.5 text-muted"><Icon name="chevron" size={15} /></div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-brand p-5 text-white shadow-card">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
                <Icon name="info" size={15} /> Reading the data
              </div>
              <div className="mt-3 text-sm leading-6 text-white/80">
                Brighter cyan areas indicate the strongest detected change. Values are modeled from radar backscatter and elevation data.
              </div>
              <div className="mt-4 text-xs font-semibold text-accent-light">View methodology →</div>
            </div>
          </aside>

          <section className="min-w-0 space-y-5">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                { label: "Ice mass change", value: `${current.ice} Gt`, note: period, icon: "snow" as IconName },
                { label: "Sea-level equivalent", value: `${current.level} mm`, note: "Global mean", icon: "water" as IconName },
                { label: "Change rate", value: current.rate, note: "Per decade", icon: "trend" as IconName },
                { label: "SAR observations", value: "18,642", note: "Processed scenes", icon: "scan" as IconName },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-line bg-panel p-4 shadow-card">
                  <div className="flex items-start justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{item.label}</div>
                    <div className="text-accent"><Icon name={item.icon} size={17} /></div>
                  </div>
                  <div className="mt-3 font-display text-2xl font-semibold tracking-tight text-brand">{item.value}</div>
                  <div className="mt-1 text-xs text-muted">{item.note}</div>
                </div>
              ))}
            </div>

            <div className="relative min-h-[460px] overflow-hidden rounded-2xl bg-brand shadow-map">
              <div
                className="absolute inset-0 transition-transform duration-300"
                style={{ transform: `scale(${zoom})` }}
              >
                <img
                  alt={`Aerial view representing ${metric === "ice" ? "ice" : "sea-level"} observations over ${location}`}
                  src={metric === "ice" ? glacierImage : seaImage}
                  className={`absolute inset-0 h-full w-full object-cover ${metric === "ice" ? "grayscale-[20%]" : "saturate-75"}`}
                />
                <div className={`absolute inset-0 ${metric === "ice" ? "bg-map-overlay" : "bg-sea-overlay"}`} />
                <div className="absolute inset-0 map-grid opacity-30" />
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 540" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="scanLine" x1="0" x2="1">
                    <stop offset="0" stopColor="#6ee7f2" stopOpacity="0" />
                    <stop offset=".5" stopColor="#6ee7f2" stopOpacity=".8" />
                    <stop offset="1" stopColor="#6ee7f2" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M-50 490C160 310 330 420 480 230S790 190 1050 20" fill="none" stroke="url(#scanLine)" strokeWidth="2" strokeDasharray="9 10" />
                {metric === "ice" ? (
                  <>
                    <path d="M190 95 365 60 440 190 275 250Z" fill="#5ee2ef" fillOpacity=".12" stroke="#7cebf4" strokeWidth="1.5" />
                    <path d="m550 260 230-50 80 150-260 50Z" fill="#5ee2ef" fillOpacity=".1" stroke="#7cebf4" strokeWidth="1.5" />
                  </>
                ) : (
                  <>
                    <path d="M40 355C180 305 265 370 405 318S690 190 970 250L1000 540H0Z" fill="#178da0" fillOpacity=".28" />
                    <path d="M40 355C180 305 265 370 405 318S690 190 970 250" fill="none" stroke="#f3c66d" strokeWidth="4" strokeDasharray="12 7" />
                    <path d="M40 370C180 320 265 385 405 333S690 205 970 265" fill="none" stroke="#7cebf4" strokeWidth="2" />
                  </>
                )}
                <circle cx="660" cy="303" r="32" fill="none" stroke="#7cebf4" strokeWidth="1.5" />
                <circle cx="660" cy="303" r="7" fill="#7cebf4" />
                <circle cx="660" cy="303" r="48" fill="none" stroke="#7cebf4" strokeOpacity=".35" />
                </svg>
              </div>

              <div className="absolute left-4 top-4 right-4 flex items-start justify-between gap-3">
                <div className="rounded-xl border border-white/20 bg-brand/80 px-4 py-3 text-white backdrop-blur-md">
                  <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent-light">Active view</div>
                  <div className="mt-1 font-display text-lg font-semibold">{location}</div>
                  <div className="mt-0.5 text-xs text-white/65">{metric === "ice" ? "Ice displacement & mass change" : "Sea-level anomaly"} · {period}</div>
                </div>
                <div className="relative">
                  <Pressable
                    className="flex items-center gap-2 rounded-xl border border-white/20 bg-brand/80 px-3 py-2.5 text-xs font-semibold text-white backdrop-blur-md"
                    onClick={() => setLayersOpen(!layersOpen)}
                  >
                    <Icon name="layers" size={16} /> Layers
                  </Pressable>
                  {layersOpen && (
                    <div className="absolute right-0 top-12 w-44 rounded-xl border border-white/15 bg-brand/95 p-3 text-xs text-white shadow-map backdrop-blur-md">
                      {["Velocity", "Mass balance", "Coastline", "SAR coverage"].map((layer, index) => (
                        <div className="flex items-center justify-between border-b border-white/10 py-2 last:border-0" key={layer}>
                          {layer}<span className={`size-2 rounded-full ${index < 3 ? "bg-accent-light" : "bg-white/30"}`} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                <div className="rounded-xl border border-white/20 bg-brand/80 p-3 text-white backdrop-blur-md">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/60">Detected change</div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span>{metric === "ice" ? "Low" : "−5 mm"}</span>
                    <span className="h-2 w-28 rounded-full bg-gradient-to-r from-white/20 via-cyan-300 to-amber-300" />
                    <span>{metric === "ice" ? "High" : "+8 mm"}</span>
                  </div>
                </div>
                <div className="text-right text-[10px] leading-4 text-white/70">
                  <div>67.14° N · 48.91° W</div>
                  <div>Sentinel-1 / NASA ASF DAAC</div>
                </div>
              </div>

              <div className="absolute right-4 top-20 flex flex-col overflow-hidden rounded-xl border border-white/20 bg-brand/80 text-white shadow-card backdrop-blur-md">
                <Pressable
                  className="flex size-10 items-center justify-center border-b border-white/15 text-xl font-medium transition hover:bg-white/10 disabled:opacity-40"
                  label="Zoom in"
                  onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                >
                  +
                </Pressable>
                <div className="flex h-7 items-center justify-center border-b border-white/15 text-[9px] font-semibold">{Math.round(zoom * 100)}%</div>
                <Pressable
                  className="flex size-10 items-center justify-center text-xl font-medium transition hover:bg-white/10 disabled:opacity-40"
                  label="Zoom out"
                  onClick={() => setZoom(Math.max(1, zoom - 0.25))}
                >
                  −
                </Pressable>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
              <div className="rounded-2xl border border-line bg-panel p-5 shadow-card">
                <div className="flex items-start justify-between">
                  <div>
                    <div role="heading" aria-level={2} className="font-display text-lg font-semibold text-brand">
                      {metric === "ice" ? "Ice mass trend" : "Mean sea-level trend"}
                    </div>
                    <div className="mt-1 text-xs text-muted">Annual observation model · {location}</div>
                  </div>
                  <div className="rounded-lg bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
                    {metric === "ice" ? "−212 Gt / yr" : "+3.7 mm / yr"}
                  </div>
                </div>
                <div className="mt-6 h-40">
                  <svg className="h-full w-full overflow-visible" viewBox="0 0 324 140" preserveAspectRatio="none" aria-label="Observation trend chart">
                    {[15, 45, 75, 105, 135].map((y) => <line key={y} x1="0" x2="324" y1={y} y2={y} stroke="#dbe5e8" strokeWidth="1" />)}
                    <polygon points={`0,140 ${chartPoints} 324,140`} fill="#64dbe6" fillOpacity=".14" />
                    <polyline points={chartPoints} fill="none" stroke="#087e8b" strokeWidth="3" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex justify-between text-[10px] font-semibold text-muted">
                  <span>{startYear}</span><span>2008</span><span>2014</span><span>2020</span><span>{endYear}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-panel p-5 shadow-card">
                <div role="heading" aria-level={2} className="font-display text-lg font-semibold text-brand">
                  What drives sea-level rise?
                </div>
                <div className="mt-1 text-xs text-muted">Estimated contribution for the selected period</div>
                <div className="mt-6 flex items-center gap-6">
                  <div
                    className="relative flex size-32 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(var(--color-accent) 0 ${current.melt}%, var(--color-brand-mid) ${current.melt}% ${current.melt + current.thermal}%, var(--color-sand) ${current.melt + current.thermal}% 100%)`,
                    }}
                  >
                    <div className="flex size-20 flex-col items-center justify-center rounded-full bg-panel">
                      <div className="font-display text-2xl font-semibold text-brand">{current.melt}%</div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted">ice melt</div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    {[
                      ["Land ice melt", current.melt, "bg-accent"],
                      ["Ocean warming", current.thermal, "bg-brand-mid"],
                      ["Other factors", current.other, "bg-sand"],
                    ].map(([label, value, color]) => (
                      <div className="flex items-center justify-between gap-3" key={String(label)}>
                        <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
                          <span className={`size-2 rounded-full ${color}`} />
                          <span className="truncate">{label}</span>
                        </div>
                        <div className="text-sm font-semibold text-brand">{value}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      ) : (
        <InfoPage type={page} onExplore={() => setPage("explore")} />
      )}

      <footer className="mx-auto flex max-w-screen-2xl flex-col gap-2 border-t border-line px-6 py-5 text-[10px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <div>Eyes of Argus · Research visualization prototype</div>
        <div>Imagery by Bernd Dittrich and USGS on Unsplash · Data references: NASA, ASF DAAC, Sentinel-1</div>
      </footer>
      <DataAssistant location={location} metric={metric} />
    </main>
  );
}

export default App;
