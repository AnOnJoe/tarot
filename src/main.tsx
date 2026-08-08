import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { setupUpdates } from './pwa'
import './theme.css'

setupUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
