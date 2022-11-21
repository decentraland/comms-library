import { AnyAction } from "redux"
import { AppState } from "./types"

const INITIAL_STATE: AppState = {
  position: null
}

export function appReducer(state?: AppState, action?: AnyAction): AppState {
  if (!state) {
    return INITIAL_STATE
  }
  if (!action) {
    return state
  }
  return state
}
