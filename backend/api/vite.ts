import type { Plugin, PreviewServer, ViteDevServer } from "vite"
import worker from "./src/index.js"

type ServerEnvironment = {
  GROQ_API_KEY?: string
  ARGUS_MODEL?: string
  ARGUS_VISION_MODEL?: string
}

// Use the same API locally; static deployments use the deployed Worker.
export function catalogueApi(env: ServerEnvironment = {}): Plugin {
  const install = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
      const base = server.config.base
      if (base !== "/" && url.pathname.startsWith(base)) url.pathname = `/${url.pathname.slice(base.length)}`
      const isCatalogue = url.pathname === "/api/health" || url.pathname.startsWith("/api/catalog/")
      if (!isCatalogue && url.pathname !== "/api/argus" && url.pathname !== "/api/analysis") return next()

      const headers: Record<string, string> = {}
      if (req.headers.origin) headers.Origin = req.headers.origin
      if (req.headers["content-type"]) headers["Content-Type"] = req.headers["content-type"]

      let body: string | undefined
      if (req.method !== "GET" && req.method !== "HEAD") {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(Buffer.from(chunk))
        body = chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined
      }

      const controller = new AbortController()
      const cancel = () => { if (!res.writableEnded) controller.abort() }
      res.on("close", cancel)
      try {
        const response = await worker.fetch(new Request(url, {
          method: req.method,
          headers,
          body,
          signal: controller.signal,
        }), env)
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(Buffer.from(await response.arrayBuffer()))
      } catch (error) {
        next(error)
      } finally {
        res.off("close", cancel)
      }
    })
  }
  return { name: "eartheyes-catalogue-api", configureServer: install, configurePreviewServer: install }
}
