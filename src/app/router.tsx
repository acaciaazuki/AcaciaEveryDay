import { createBrowserRouter } from 'react-router'
import { CalendarPage } from '../pages/CalendarPage'
import { PlacesPage } from '../pages/PlacesPage'
import { RemindersPage } from '../pages/RemindersPage'
import { SettingsPage } from '../pages/SettingsPage'
import { ShoppingPage } from '../pages/ShoppingPage'
import { SubscriptionsPage } from '../pages/SubscriptionsPage'
import { TasksPage } from '../pages/TasksPage'
import { TodayPage } from '../pages/TodayPage'
import { Layout } from './Layout'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: TodayPage },
      { path: 'calendar', Component: CalendarPage },
      { path: 'places', Component: PlacesPage },
      { path: 'tasks', Component: TasksPage },
      { path: 'shopping', Component: ShoppingPage },
      { path: 'reminders', Component: RemindersPage },
      { path: 'subscriptions', Component: SubscriptionsPage },
      { path: 'settings', Component: SettingsPage },
    ],
  },
])
