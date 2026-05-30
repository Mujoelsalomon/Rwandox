import { useCallback, useMemo, useState } from 'react'

const SIDEBAR_WIDTH_KEY = 'postop-sidebar-width'
const MIN_SIDEBAR_WIDTH = 92
const DEFAULT_SIDEBAR_WIDTH = 292
const MAX_SIDEBAR_WIDTH = 420
const COLLAPSE_THRESHOLD = 148

function clampSidebarWidth(width) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)))
}

function readStoredSidebarWidth() {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_WIDTH

  const storedWidth = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY))
  return Number.isFinite(storedWidth) ? clampSidebarWidth(storedWidth) : DEFAULT_SIDEBAR_WIDTH
}

export function useResizableSidebar(setSidebarOpen) {
  const [sidebarWidth, setSidebarWidth] = useState(readStoredSidebarWidth)

  const updateSidebarWidth = useCallback((nextWidth) => {
    const width = clampSidebarWidth(nextWidth)
    setSidebarWidth(width)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width))
    }

    setSidebarOpen(width > COLLAPSE_THRESHOLD)
  }, [setSidebarOpen])

  const handleSidebarResizeStart = useCallback((event) => {
    if (typeof window === 'undefined' || window.innerWidth < 1024) return

    event.preventDefault()
    const pointerId = event.pointerId
    const target = event.currentTarget

    target.setPointerCapture?.(pointerId)
    document.body.classList.add('sidebar-resizing')

    function handlePointerMove(moveEvent) {
      updateSidebarWidth(moveEvent.clientX)
    }

    function handlePointerUp() {
      target.releasePointerCapture?.(pointerId)
      document.body.classList.remove('sidebar-resizing')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }, [updateSidebarWidth])

  const handleSidebarResizeKeyDown = useCallback((event) => {
    const step = event.shiftKey ? 24 : 12

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      updateSidebarWidth(sidebarWidth - step)
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      updateSidebarWidth(sidebarWidth + step)
    }
  }, [sidebarWidth, updateSidebarWidth])

  const sidebarWidthStyle = useMemo(() => ({
    '--sidebar-width': `${sidebarWidth}px`,
  }), [sidebarWidth])

  return {
    maxSidebarWidth: MAX_SIDEBAR_WIDTH,
    minSidebarWidth: MIN_SIDEBAR_WIDTH,
    sidebarWidth,
    sidebarWidthStyle,
    onSidebarResizeKeyDown: handleSidebarResizeKeyDown,
    onSidebarResizeStart: handleSidebarResizeStart,
  }
}
