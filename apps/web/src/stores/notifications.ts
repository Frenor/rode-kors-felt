import { create } from 'zustand';

export type ToastLevel = 'info' | 'warning' | 'urgent';

export interface Toast {
  id: string;
  message: string;
  level: ToastLevel;
  patientId?: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  /** Auto-dismiss after this many ms. 0 = persist until dismissed. */
  autoDismissMs: number;
}

interface NotificationStore {
  toasts: Toast[];
  add: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  toasts: [],

  add: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },

  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
