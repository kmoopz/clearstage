import { AlertCircle, CheckCircle2, Info, X, TriangleAlert } from 'lucide-react'
import { useAppStore } from '../store'

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info
}

export function Toasts() {
  const toasts = useAppStore((state) => state.toasts)
  const dismiss = useAppStore((state) => state.dismissToast)
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind]
        return (
          <div key={toast.id} className={`toast toast-${toast.kind}`}>
            <span className="toast-icon">
              <Icon size={16} />
            </span>
            <div className="toast-copy">
              <strong>{toast.text}</strong>
              {toast.detail && <p>{toast.detail}</p>}
            </div>
            <button className="toast-close" onClick={() => dismiss(toast.id)} aria-label="关闭提示">
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
