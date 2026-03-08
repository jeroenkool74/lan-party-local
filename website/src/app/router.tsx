import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { GamePage } from '../pages/GamePage'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'games/:slug',
        element: <GamePage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])
