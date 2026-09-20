import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { JournalContextProvider } from './context/journalContextProvider.jsx'
import Home from './Home.jsx'
import {createBrowserRouter, RouterProvider } from 'react-router'
import MainJournal from './pages/MainJournal.jsx'

const router = createBrowserRouter([
  {
    path:'/',
    element:<Home/>,
    children:[
      {
        path:'',
        element:<MainJournal/>
      }
    ]
  }
])
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <JournalContextProvider>
      <RouterProvider router={router}/>
    </JournalContextProvider>
  </StrictMode>,
)
