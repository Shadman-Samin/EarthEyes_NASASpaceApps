import type { Meta, StoryObj } from "@storybook/react-vite"
import { ComparisonViewer } from "../features/comparison/ComparisonViewer"
import { observations } from "../mocks/fixtures"

const pair = observations.filter((observation) => observation.placeId === "jakobshavn-glacier" && observation.platform === "NISAR")
const meta = {
  title: "Explorer/ComparisonViewer",
  component: ComparisonViewer,
  args: { left: pair[0], right: pair[1], mode: "swipe" },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ComparisonViewer>
export default meta
type Story = StoryObj<typeof meta>
export const Swipe: Story = {}
export const SideBySide: Story = { args: { mode: "side-by-side" } }
export const Difference: Story = { args: { mode: "difference" } }
export const Single: Story = { args: { mode: "single" } }
export const ReducedMotion: Story = { parameters: { chromatic: { prefersReducedMotion: "reduce" } } }
