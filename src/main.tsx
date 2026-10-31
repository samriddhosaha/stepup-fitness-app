import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { loadCustomExercises } from './lib/customExercises'
import { installErrorLogging } from './lib/errorLog'
import { ensureDefaultHabits } from './lib/healthStore'

installErrorLogging()

// Custom exercises are looked up synchronously everywhere, so load them before the first render.
// Starter habits are added once; failing to add them must never block the app.
void ensureDefaultHabits().catch(() => undefined)

loadCustomExercises()
  .catch(() => undefined)
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
