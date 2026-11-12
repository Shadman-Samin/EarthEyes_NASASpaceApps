import { useRef, useState } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { Icon } from "../shared/ui"
import { RouteAnnouncer } from "./RouteAnnouncer"

const navigation = [
  ["/", "Home"],
  ["/explore", "Explore"],
  ["/methodology", "Methodology"],
  ["/data-sources", "Data sources"],
  ["/groundline", "GroundLine"],
  ["/about", "About"],
] as const

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const explorer = location.pathname.startsWith("/explore")

  return (
    <div className={`app-shell ${explorer ? "app-shell--explorer" : ""}`}>
      <a className="skip-link" href="#route-content">Skip to main content</a>
      <div className="signal-strip" aria-hidden="true" />
      <header className="site-header" onKeyDown={(event) => {
        if (event.key === "Escape" && mobileOpen) {
          setMobileOpen(false)
          menuButton.current?.focus()
        }
      }} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMobileOpen(false)
      }}>
        <Link to="/" className="site-brand" aria-label="EarthEyes Field Atlas home" onClick={() => setMobileOpen(false)}>
          <span className="site-brand__mark"><Icon name="globe" size={20} /></span>
          <span><strong>EARTH<em>EYES</em></strong><small>Field atlas</small></span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          {navigation.map(([href, label]) => <NavLink key={href} to={href} end={href === "/"} className={({ isActive }) => isActive ? "is-active" : ""}>{label}</NavLink>)}
        </nav>
        <div className="site-header__status"><span><i /> Research prototype</span><Link to="/explore" className="site-header__cta">Open explorer <Icon name="arrow" size={14} /></Link></div>
        <button ref={menuButton} className="site-menu" type="button" aria-expanded={mobileOpen} aria-controls={mobileOpen ? "mobile-nav" : undefined} aria-label={mobileOpen ? "Close navigation" : "Open navigation"} onClick={() => setMobileOpen((current) => !current)}><Icon name={mobileOpen ? "close" : "menu"} size={20} /></button>
        {mobileOpen && <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">{navigation.map(([href, label]) => <NavLink key={href} to={href} end={href === "/"} onClick={() => setMobileOpen(false)}>{label}<Icon name="arrow" size={15} /></NavLink>)}</nav>}
      </header>
      <RouteAnnouncer />
      <div id="route-content" tabIndex={-1}>
        <Outlet />
      </div>
      {!explorer && <Footer />}
    </div>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__identity">
        <Link to="/" className="site-footer__brand">EARTH<span>EYES</span><Icon name="globe" size={28} /></Link>
        <p>An Earth-observation field atlas for NASA Space Apps. Real archive discovery, exploratory preview comparison, and a visible boundary between evidence and explanation.</p>
      </div>
      <nav aria-label="Footer navigation"><Link to="/">Home</Link><Link to="/explore">Explore</Link><Link to="/about">About</Link><a href="https://github.com/Shadman-Samin/EarthEyes_NASASpaceApps" target="_blank" rel="noreferrer">Source code <Icon name="external" size={14} /></a></nav>
      <div className="site-footer__colophon"><span>Research prototype / Not an operational warning service</span><a href="https://nisar.jpl.nasa.gov/" target="_blank" rel="noreferrer">NASA / ISRO NISAR mission <Icon name="external" size={14} /></a></div>
    </footer>
  )
}
