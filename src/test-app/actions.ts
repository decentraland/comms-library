import { action } from "typesafe-actions"

export const CONNECT_PROVIDER = "APP: Conenct provider"
export const connectProvider = (provider: any) => action(CONNECT_PROVIDER, { provider })

export const SET_ADAPTER = "APP: Set adapter"
export const setCommsAdapter = (adapter: string) => action(SET_ADAPTER, { adapter })