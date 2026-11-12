import type { Plugin, PreviewServer, ViteDevServer } from "vite"
import worker from "./src/index.js"

// Use the same read-only API locally; static deployments use the deployed Worker.
export function catalogueApi(): Plugin {
  const install = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
      const base = server.config.base
      if (base !== "/" && url.pathname.startsWith(base)) url.pathname = `/${url.pathname.slice(base.length)}`
      if (url.pathname !== "/api/health" && !url.pathname.startsWith("/api/catalog/")) return next()

      const controller = new AbortController()
      const cancel = () => { if (!res.writableEnded) controller.abort() }
      res.on("close", cancel)
      try {
        const response = await worker.fetch(new Request(url, {
          method: req.method,
          headers: req.headers.origin ? { Origin: req.headers.origin } : {},
          signal: controller.signal,
        }))
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
