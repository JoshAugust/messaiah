import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light'
export type ModalType = 'import-csv' | 'contact-detail' | 'confirm-delete' | 'path-result' | null

interface Modal {
  type: ModalType
  props?: Record<string, unknown>
}

interface UIState {
  sidebarCollapsed: boolean
  theme: Theme
  activeModal: Modal
  notifications: Notification[]
  commandPaletteOpen: boolean

  // Actions
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setTheme: (theme: Theme) => void
  openModal: (type: ModalType, props?: Record<string, unknown>) => void
  closeModal: () => void
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  toggleCommandPalette: () => void
}

interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  duration?: number
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'dark',
      activeModal: { type: null },
      notifications: [],
      commandPaletteOpen: false,

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      setTheme: (theme) => set({ theme }),

      openModal: (type, props) => set({ activeModal: { type, props } }),

      closeModal: () => set({ activeModal: { type: null } }),

      addNotification: (notification) => {
        const id = crypto.randomUUID()
        set((state) => ({
          notifications: [...state.notifications, { ...notification, id }],
        }))
        // Auto-remove after duration
        const duration = notification.duration ?? 5000
        if (duration > 0) {
          setTimeout(() => {
            set((state) => ({
              notifications: state.notifications.filter((n) => n.id !== id),
            }))
          }, duration)
        }
      },

      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      toggleCommandPalette: () =>
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
    }),
    {
      name: 'messaiah-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
)
