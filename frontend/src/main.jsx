import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { JournalContextProvider } from './context/journalContextProvider.jsx'
import Home from './Home.jsx'
import {createBrowserRouter, RouterProvider } from 'react-router'
import MainJournal from './pages/MainJournal.jsx'
import AuthPage from './pages/AuthPage.jsx'
import LazyPlannerPage from './pages/LazyPlannerPage.jsx'
import { PlannerContextProvider } from './context/plannerContextProvider.jsx'

const router = createBrowserRouter([
  {
    path:'/auth',
    element:<AuthPage/>
  },
  {
    path:'/',
    element:<Home/>,
    children:[
      {
        path:'',
        element:<MainJournal/>
      },
      {
        path:'planner/:plannerId',
        element:<LazyPlannerPage/>
      }
    ]
  }
])
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <JournalContextProvider>
      <PlannerContextProvider>
        <RouterProvider router={router}/>
      </PlannerContextProvider>
    </JournalContextProvider>
  </StrictMode>,
)
