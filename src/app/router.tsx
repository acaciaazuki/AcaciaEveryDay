import { createBrowserRouter } from 'react-router'
import { ComingSoon } from '../pages/ComingSoon'
import { SettingsPage } from '../pages/SettingsPage'
import { TasksPage } from '../pages/TasksPage'
import { Layout } from './Layout'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, element: <ComingSoon page="today" /> },
      { path: 'calendar', element: <ComingSoon page="calendar" /> },
      { path: 'places', element: <ComingSoon page="places" /> },
      { path: 'tasks', Component: TasksPage },
      { path: 'shopping', element: <ComingSoon page="shopping" /> },
      { path: 'settings', Component: SettingsPage },
    ],
  },
])
