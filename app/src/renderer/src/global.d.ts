import type { ClearStageApi } from '../../shared/api'

declare global {
  interface Window {
    clearstage: ClearStageApi
  }
}

export {}
