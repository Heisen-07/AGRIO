import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register the offline service worker in production builds only
// (avoids caching unbundled modules / breaking HMR during `vite dev`).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Force an update check on every load so a reconnecting device picks up
        // a newer build instead of running the cached bundle indefinitely.
        registration.update()
        // When a new worker finishes installing while an old one still controls
        // the page, reload once to swap in the new assets. Skipped on the first
        // install (no existing controller), so a fresh visit never reloads.
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.location.reload()
            }
          })
        })
      })
      .catch((err) => console.warn('Service worker registration failed:', err))
  })
}
