import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { loadCustomExercises } from './lib/customExercises'

// Custom exercises are looked up synchronously everywhere, so load them before the first render.
loadCustomExercises()
  .catch(() => undefined)
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
