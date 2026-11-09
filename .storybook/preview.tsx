import type { Preview } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import "@fontsource-variable/manrope"
import "@fontsource-variable/dm-sans"
import "@fontsource/dm-mono/400.css"
import "../src/index.css"

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const preview: Preview = {
  decorators: [(Story) => <QueryClientProvider client={client}><MemoryRouter><div style={{ padding: 24 }}><Story /></div></MemoryRouter></QueryClientProvider>],
  parameters: {
    layout: "fullscreen",
    a11y: { test: "error" },
    backgrounds: { default: "paper", values: [{ name: "paper", value: "#f1efe5" }, { name: "forest", value: "#102824" }] },
  },
}

export default preview
