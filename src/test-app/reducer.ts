import { AnyAction } from "redux"
import { commsReducer } from "../lib/reducer"
import { combineReducers } from "redux"
import { RootState } from "./types"
import { appReducer } from "./kernel/reducer"

export const reducers = combineReducers<RootState>({
  comms: commsReducer,
  app: appReducer,
})
