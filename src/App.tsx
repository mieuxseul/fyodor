import { BrowserRouter } from 'react-router-dom'

import { ThemeProvider } from '@/app/ThemeProvider'
import { AppRouter } from '@/app/router'
import { Toaster } from '@/components/ui/Toaster'
import { useF11Fullscreen } from '@/hooks/useF11Fullscreen'

function AppHotkeys() {
  useF11Fullscreen()
  return null
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppHotkeys />
        <AppRouter />
        <Toaster />
      </BrowserRouter>
    </ThemeProvider>
  )
}
