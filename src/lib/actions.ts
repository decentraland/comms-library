import { IslandChangedMessage } from "@dcl/protocol/out-ts/decentraland/kernel/comms/v3/archipelago.gen"
import { action } from "typesafe-actions"
import { RoomConnection } from "./interface"
import { CommsIdentity, PositionReader } from "./types"
import { Avatar } from "@dcl/schemas"

export const COMMS_INITIALIZED = "[COMMS] commsInitialized"
export const commsInitialized = (
  identity: CommsIdentity,
  positionReader: PositionReader,
  profileBaseUrl: string,
  profile: Avatar
) => action(COMMS_INITIALIZED, { identity, positionReader, profileBaseUrl, profile })
export type CommsInitializedAction = ReturnType<typeof commsInitialized>

// this action is triggered by the IBff, it is used to connect a comms adapter
export const CONNECT_TO_COMMS = "[COMMS] commsConnectToAdapter"
export const commsConnectToAdapter = (event: IslandChangedMessage) => action(CONNECT_TO_COMMS, { event })
export type ConnectToCommsAction = ReturnType<typeof commsConnectToAdapter>

export const ERROR_CONNECTING_COMMS_ADAPTER = "[COMMS] errorConnectingCommsAdapter"
export const errorConnectingCommsAdapter = (error: Error) => action(ERROR_CONNECTING_COMMS_ADAPTER, { error })
export type ErrorConnectingCommsAdapterAction = ReturnType<typeof errorConnectingCommsAdapter>

// this action is triggered to broadcast a new comms profile
export const SET_COMMS_PROFILE = "[COMMS] setCommsProfile"
export const setCommsProfile = (avatar: Avatar, avatarBaseUrl: string) =>
  action(SET_COMMS_PROFILE, { avatar, avatarBaseUrl })
export type SetCommsProfileAction = ReturnType<typeof setCommsProfile>

export const SET_COMMS_ISLAND = "[COMMS] setCommsIsland"
export const setCommsIsland = (island: string | undefined) => action(SET_COMMS_ISLAND, { island })
export type SetCommsIslandAction = ReturnType<typeof setCommsIsland>

export const SET_ROOM_CONNECTION = "[COMMS] setRoomConnection"
export const setRoomConnection = (room: RoomConnection | undefined) => action(SET_ROOM_CONNECTION, room)
export type SetRoomConnectionAction = ReturnType<typeof setRoomConnection>

export const HANDLE_ROOM_DISCONNECTION = "[COMMS] handleRoomDisconnection"
export const handleRoomDisconnection = (room: RoomConnection) => action(HANDLE_ROOM_DISCONNECTION, { context: room })
export type HandleRoomDisconnectionAction = ReturnType<typeof handleRoomDisconnection>

export const ESTABLISHING_COMMS = "[COMMS] establishingComms"
export const establishingComms = () => action(ESTABLISHING_COMMS)

export const COMMS_ESTABLISHED = "[COMMS] commsEstablished"
export const commsEstablished = () => action(COMMS_ESTABLISHED)
