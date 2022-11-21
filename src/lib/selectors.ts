import { AuthIdentity } from "@dcl/crypto"
import { Position } from "@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen"
import { Avatar } from "@dcl/schemas"
import { RoomConnection } from "./interface"
import { RootCommsState } from "./types"

export const getCommsIsland = (store: RootCommsState): string | undefined => store.comms.island
export const getCommsRoom = (state: RootCommsState): RoomConnection | undefined => state.comms.context
export const getCommsIdentity = (state: RootCommsState): AuthIdentity | undefined => state.comms.identity
export const getCurrentCommsProfile = (state: RootCommsState): Avatar | undefined => state.comms.profile
export const getCurrentCommsProfileBaseUrl = (state: RootCommsState): string | undefined => state.comms.profileBaseUrl
export const getCurrentPositionReader = (state: RootCommsState): (() => Position) | undefined =>
  state.comms.positionReader
