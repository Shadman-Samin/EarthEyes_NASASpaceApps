import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react"
import { createBrowserRouter, Link } from "react-router-dom"
import { KUAKATA_PILOT_URL } from "../shared/links"
import { Icon, Skeleton } from "../shared/ui"
import { AppShell } from "./AppShell"
import { RouteErrorBoundary } from "./ErrorBoundary"

const LandingPage = lazy(() => import("../routes/landing/LandingPage").then((module) => ({ default: module.LandingPage })))
const ExplorerPage = lazy(() => import("../routes/explore/ExplorerPage").then((module) => ({ default: module.ExplorerPage })))
const StoryPage = lazy(() => import("../routes/stories/StoryPage").then((module) => ({ default: module.StoryPage })))
const MethodologyPage = lazy(() => import("../routes/methodology/MethodologyPage").then((module) => ({ default: module.MethodologyPage })))
const DataSourcesPage = lazy(() => import("../routes/data-sources/DataSourcesPage").then((module) => ({ default: module.DataSourcesPage })))
const DataSourceDetailPage = lazy(() => import("../routes/data-sources/DataSourceDetailPage").then((module) => ({ default: module.DataSourceDetailPage })))
const GroundLinePage = lazy(() => import("../routes/groundline/GroundLinePage").then((module) => ({ default: module.GroundLinePage })))
const AboutPage = lazy(() => import("../routes/about/AboutPage").then((module) => ({ default: module.AboutPage })))

const deferred = (Page: LazyExoticComponent<ComponentType>) => (
  <Suspense fallback={<main id="main-content" className="route-loading"><Skeleton lines={8} /></main>}>
    <Page />
  </Suspense>
)

function NotFoundPage() {
  return (
    <main id="main-content" className="content-page not-found">
      <span className="section-kicker">404 / Route not found</span>
      <h1>This trail<br /><em>ends here.</em></h1>
      <p>The page may have moved, or the address may be incomplete. Every real investigation is still reachable from the field atlas.</p>
      <div className="not-found__actions">
        <Link className="button button--primary button--medium" to="/">Return home</Link>
        <Link className="button button--secondary button--medium" to="/explore">Open the explorer</Link>
        <Link className="text-link" to={KUAKATA_PILOT_URL}>Inspect the Kuakata study <Icon name="arrow" size={16} /></Link>
      </div>
    </main>
  )
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: deferred(LandingPage) },
      { path: "explore", element: deferred(ExplorerPage) },
      { path: "explore/:placeId", element: deferred(ExplorerPage) },
      { path: "stories/:storySlug", element: deferred(StoryPage) },
      { path: "methodology", element: deferred(MethodologyPage) },
      { path: "data-sources", element: deferred(DataSourcesPage) },
      { path: "data-sources/:sourceId", element: deferred(DataSourceDetailPage) },
      { path: "groundline", element: deferred(GroundLinePage) },
      { path: "about", element: deferred(AboutPage) },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
], { basename: import.meta.env.BASE_URL })
