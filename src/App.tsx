import { BrowserRouter } from 'react-router-dom'

import { ThemeProvider } from '@/app/ThemeProvider'
import { AppRouter } from '@/app/router'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </ThemeProvider>
  )
}
