import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AppProvider } from './contexts/AppContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { CacheProvider } from './contexts/CacheContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NotificationProvider>
      <CacheProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </CacheProvider>
    </NotificationProvider>
  </StrictMode>,
) 