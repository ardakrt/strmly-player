import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Remove the static HTML/CSS boot splash now that React has taken over
// rendering (App renders its own matching SplashScreen while it boots).
document.getElementById('boot-splash')?.remove()
