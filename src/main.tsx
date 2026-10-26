import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/global.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { AuthProvider } from './hooks/useAuth.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { startServiceWorker } from './lib/serviceWorker.ts'
import { startVersionWatch } from './lib/appVersion.ts'

// Keep installed / long-open copies current: look for service-worker updates and compare the
// running build with /version.json on start and whenever the app comes back to the foreground.
startServiceWorker()
startVersionWatch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
