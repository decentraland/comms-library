import { AuthIdentity } from "@dcl/crypto"
import { Avatar } from "@dcl/schemas"
import { RoomConnection } from "./interface"
import * as rfc4 from "@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen"
import { ILogger } from "@dcl/rpc"

export type CommsIdentity = AuthIdentity & {
  hasConnectedWeb3: boolean
}

export type PositionReader = () => rfc4.Position

export type CommsState = {
  profileBaseUrl: string | undefined
  profile: Avatar | undefined
  identity: CommsIdentity | undefined
  initialized: boolean
  island?: string
  context: RoomConnection | undefined
  positionReader: PositionReader | undefined
}

export type TransportCreatorParameters = {
  positionReader: PositionReader
  identity: CommsIdentity
  islandId: string
  connectionString: string
  logger: ILogger
}

export type TransportCreator = (params: TransportCreatorParameters) => Promise<RoomConnection>

export type CommsConnectionState =
  | "initial"
  | "connecting"
  | "connected"
  | "error"
  | "realm-full"
  | "reconnection-error"
  | "id-taken"
  | "disconnecting"

export type CommsStatus = {
  status: CommsConnectionState
  connectedPeers: number
}

export type RootCommsState = {
  comms: CommsState
}
// These types appear to be unavailable when compiling for some reason, so we add them here

type RTCIceCredentialType = "password"

export interface RTCIceServer {
  credential?: string
  credentialType?: RTCIceCredentialType
  urls: string | string[]
  username?: string
}

export type VoiceHandler = {
  // UI Methods
  // setTalking is called from the UI or keyboard to broadcast audio
  setRecording(recording: boolean): void

  // used to know if a user is talking or not, for the UI
  onUserTalking(cb: (userId: string, talking: boolean) => void): void

  onError(cb: (message: string) => void): void

  onRecording(cb: (recording: boolean) => void): void

  // Controls Methods
  reportPosition(position: rfc4.Position): void
  reportPeerPosition(address: string, position: rfc4.Position): void

  setVolume(volume: number): void

  setMute(mute: boolean): void

  setInputStream(stream: MediaStream): Promise<void>

  hasInput(): boolean

  // Play audio when we recive it from comms (only for opus)
  playEncodedAudio?(address: string, relativePosition: rfc4.Position, encoded: rfc4.Voice): Promise<void>

  destroy(): Promise<void>
}
