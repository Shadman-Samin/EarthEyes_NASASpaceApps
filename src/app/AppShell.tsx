import { useState } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { Argus } from "../features/argus/Argus"
import { Icon } from "../shared/ui"
import { RouteAnnouncer } from "./RouteAnnouncer"
import { getDataOrigin } from "../data/repository"

const navigation = [
  ["/explore", "Explore"],
  ["/methodology", "Methodology"],
  ["/data-sources", "Data sources"],
  ["/groundline", "GroundLine"],
  ["/about", "About"],
] as const

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const explorer = location.pathname.startsWith("/explore")

  return (
    <div className={`app-shell ${explorer ? "app-shell--explorer" : ""}`}>
      <a className="skip-link" href="#route-content">Skip to main content</a>
      <div className="signal-strip" aria-hidden="true" />
      <header className="site-header">
        <Link to="/" className="site-brand" aria-label="EarthEyes Field Atlas home" onClick={() => setMobileOpen(false)}>
          <span className="site-brand__mark"><Icon name="globe" size={20} /></span>
          <span><strong>EARTH<em>EYES</em></strong><small>Field atlas</small></span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          {navigation.map(([href, label]) => <NavLink key={href} to={href} className={({ isActive }) => isActive ? "is-active" : ""}>{label}</NavLink>)}
        </nav>
        <div className="site-header__status"><span><i /> Research prototype</span><Link to="/explore" className="site-header__cta">Open explorer <Icon name="arrow" size={14} /></Link></div>
        <button className="site-menu" type="button" aria-expanded={mobileOpen} aria-controls="mobile-nav" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} onClick={() => setMobileOpen((current) => !current)}><Icon name={mobileOpen ? "close" : "menu"} size={20} /></button>
        {mobileOpen && <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">{navigation.map(([href, label]) => <NavLink key={href} to={href} onClick={() => setMobileOpen(false)}>{label}<Icon name="arrow" size={15} /></NavLink>)}</nav>}
      </header>
      <RouteAnnouncer />
      <div id="route-content" tabIndex={-1}>
        <Outlet />
      </div>
      {!explorer && <Footer />}
      <Argus />
    </div>
  )
}

function Footer() {
  const fixtureData = getDataOrigin() === "fixture"
  return (
    <footer className="site-footer">
      <div><Link to="/" className="site-footer__brand">EARTH<span>EYES</span> / FIELD ATLAS</Link><p>Research visualization prototype for NASA Space Apps. {fixtureData ? "Fixture imagery and values are not operational products." : "Connected records remain non-operational unless explicitly issued by a responsible authority."}</p></div>
      <nav aria-label="Footer navigation"><Link to="/methodology">Methodology</Link><Link to="/data-sources">Data sources</Link><Link to="/groundline">GroundLine</Link><a href="https://nisar.jpl.nasa.gov/" target="_blank" rel="noreferrer">NASA NISAR <Icon name="external" size={12} /></a></nav>
    </footer>
  )
}
