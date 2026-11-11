import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/manrope'
import '@fontsource-variable/dm-sans'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import App from './App'
import './index.css'
import { prefersLowBandwidth } from './shared/network'
import { activateFixtureRepository } from './data/repository'

if (prefersLowBandwidth()) document.documentElement.dataset.dataMode = 'low'
if (!import.meta.env.VITE_API_BASE_URL) activateFixtureRepository()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
