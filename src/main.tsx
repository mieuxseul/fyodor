import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { hydrateAppPrefs } from './lib/app-prefs'
import './index.css'

hydrateAppPrefs()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
