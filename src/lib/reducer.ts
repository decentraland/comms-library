import { AnyAction } from "redux"
import { CommsState } from "./types"
import { CommsInitializedAction, COMMS_INITIALIZED, SET_COMMS_ISLAND, SET_ROOM_CONNECTION } from "./actions"

const INITIAL_COMMS: CommsState = {
  initialized: false,
  context: undefined,
  identity: undefined,
  profile: undefined,
  profileBaseUrl: undefined,
  positionReader: undefined,
  island: undefined,
}

export function commsReducer(state?: CommsState, action?: AnyAction): CommsState {
  if (!state) {
    return INITIAL_COMMS
  }
  if (!action) {
    return state
  }
  switch (action.type) {
    case COMMS_INITIALIZED:
      const payload = (action as CommsInitializedAction).payload
      return {
        ...state,
        initialized: true,
        identity: payload.identity,
        positionReader: payload.positionReader,
        profile: payload.profile,
        profileBaseUrl: payload.profileBaseUrl,
      }
    case SET_COMMS_ISLAND:
      return { ...state, island: action.payload.island }
    case SET_ROOM_CONNECTION:
      if (state.context === action.payload) {
        return state
      }
      return { ...state, context: action.payload }
    default:
      return state
  }
}
