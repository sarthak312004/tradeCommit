import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { JournalContextProvider } from './context/journalContextProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <JournalContextProvider>
      <App />
    </JournalContextProvider>
  </StrictMode>,
)
