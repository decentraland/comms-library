import { action } from 'typesafe-actions'

export const FATAL_ERROR = 'FATAL_ERROR'
export const BEFORE_UNLOAD = 'BEFORE_UNLOAD'
export const beforeUnloadAction = () => action(BEFORE_UNLOAD)
