import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button, DataBadge, Icon, QualityBadge, StatePanel } from "../shared/ui"

function Foundation() {
  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 900 }}>
      <section style={{ display: "flex", flexWrap: "wrap", gap: 10 }}><Button>Primary action <Icon name="arrow" size={15} /></Button><Button tone="secondary">Secondary</Button><Button tone="danger">Warning action</Button></section>
      <section style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{(["observed", "derived", "modeled", "context", "interpretation", "authority-alert"] as const).map((value) => <DataBadge key={value} value={value} />)}</section>
      <section style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{(["validated", "provisional", "review-required", "limited"] as const).map((value) => <QualityBadge key={value} value={value} />)}</section>
      <StatePanel title="No observation coverage" message="The selected source has no compatible acquisition for this date." icon="calendar" />
    </div>
  )
}

const meta = { title: "EarthEyes/Foundation", component: Foundation, tags: ["autodocs"] } satisfies Meta<typeof Foundation>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
