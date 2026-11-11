import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom"
import { Icon } from "../shared/ui"

export function RouteErrorBoundary() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "An unexpected interface error occurred."

  return (
    <main id="main-content" className="fatal-error" tabIndex={-1}>
      <Icon name="alert" size={26} />
      <span className="section-kicker">Explorer interruption</span>
      <h1>This view could not be opened.</h1>
      <p>{message}</p>
      <Link className="button button--primary button--medium" to="/">Return home</Link>
    </main>
  )
}
