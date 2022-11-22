import { AnyAction } from "redux"
import { CONNECT_TO_COMMS, ErrorConnectingCommsAdapterAction, ERROR_CONNECTING_COMMS_ADAPTER } from "../../lib"
import { AppState } from "./types"

const INITIAL_STATE: AppState = {
  error: null,
}

export function appReducer(state?: AppState, action?: AnyAction): AppState {
  if (!state) {
    return INITIAL_STATE
  }
  if (!action) {
    return state
  }
  switch (action.type) {
    case ERROR_CONNECTING_COMMS_ADAPTER:
      return { ...state, error: (action as ErrorConnectingCommsAdapterAction).payload.error }
    case CONNECT_TO_COMMS:
      return { ...state, error: null }
  }
  return state
}
