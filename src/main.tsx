import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Router } from 'wouter'
import './theme/base.css'
import App from './App.tsx'

// Routes live under Vite's base path (GitHub Pages serves from /<repo>/).
const base = import.meta.env.BASE_URL.replace(/\/$/, '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router base={base}>
      <App />
    </Router>
  </StrictMode>,
)
