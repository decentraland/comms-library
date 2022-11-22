import { createUnsafeIdentity } from "@dcl/crypto/dist/crypto"
import { Vector3 } from "@dcl/ecs-math"
import { Avatar } from "@dcl/schemas"
import mitt from "mitt"
import {
  AnnounceProfileVersion,
  Chat,
  Packet,
  Position,
  ProfileRequest,
  ProfileResponse,
  Scene,
  Voice,
} from "@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen"
import { CommsEvents, RoomConnection, TopologyParams } from "../interface"
import { Rfc4RoomConnection } from "../logic/rfc-4-room-connection"
import { CommsAdapterEvents, SendHints } from "./types"
import { PositionReader, VoiceHandler } from "../types"
import { createOpusVoiceHandler } from "../voice/opusVoiceHandler"

export class SimulationRoom implements RoomConnection {
  events = mitt<CommsEvents>()

  tick: any

  peers = new Map<
    string,
    {
      position: Vector3
      identity: ReturnType<typeof createUnsafeIdentity>
      profile: Avatar
      epoch: number
      positionMessage: Uint8Array
      profileMessage: Uint8Array
    }
  >()

  private roomConnection: Rfc4RoomConnection
  params: URLSearchParams

  constructor(param: string, private positionReader: PositionReader) {
    this.params = new URLSearchParams(param.startsWith("?") ? param.substring(1) : param)
    this.tick = setInterval(this.update.bind(this), 60)
    this.roomConnection = new Rfc4RoomConnection({
      events: mitt<CommsAdapterEvents>(),
      send(_data: Uint8Array, _hints: SendHints): void {},
      async connect(): Promise<void> {},
      async disconnect(_error?: Error): Promise<void> {},
      async getVoiceHandler() {
        return null as any
      },
    })
  }
  getDebugTopology(): Map<string, Map<string, TopologyParams>> {
    return new Map
  }

  async getVoiceHandler(): Promise<VoiceHandler> {
    return createOpusVoiceHandler((frame) => {})
  }

  async spawnPeer(): Promise<string> {
    const identity = createUnsafeIdentity()
    const address = identity.address

    const avatar = backupProfile(address) // MIGRATE: await generateRandomUserProfile(address, "simulator")

    const pos = this.positionReader()

    this.peers.set(address, {
      identity,
      position: new Vector3(pos.positionX, pos.positionY, pos.positionZ),
      profile: avatar,
      epoch: 0,
      positionMessage: Packet.encode({
        message: {
          $case: "position",
          position: {
            positionX: 0,
            positionY: 0,
            positionZ: 1,
            rotationW: 1,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            index: 123213,
          },
        },
      }).finish(),
      profileMessage: Packet.encode({
        message: {
          $case: "profileVersion",
          profileVersion: {
            profileVersion: 1,
          },
        },
      }).finish(),
    })

    this.events.emit("profileMessage", {
      address,
      data: { profileVersion: 0 },
    })

    return address
  }

  async sendProfileMessage(profile: AnnounceProfileVersion): Promise<void> {
    return this.roomConnection.sendProfileMessage(profile)
  }
  async sendProfileRequest(request: ProfileRequest): Promise<void> {
    await this.roomConnection.sendProfileRequest(request)
    const peer = this.peers.get(request.address)
    if (peer) {
      setTimeout(() => {
        this.events.emit("profileResponse", {
          address: request.address,
          data: { serializedProfile: JSON.stringify(peer.profile), baseUrl: `https://peer.decentraland.org` },
        })
      }, Math.random() * 100)
    }
  }
  async sendProfileResponse(response: ProfileResponse): Promise<void> {
    await this.roomConnection.sendProfileResponse(response)
  }
  async sendPositionMessage(position: Omit<Position, "index">): Promise<void> {
    await this.roomConnection.sendPositionMessage(position)
  }
  async sendParcelSceneMessage(message: Scene): Promise<void> {
    await this.roomConnection.sendParcelSceneMessage(message)
  }
  async sendChatMessage(message: Chat): Promise<void> {
    await this.roomConnection.sendChatMessage(message)
  }
  async sendVoiceMessage(message: Voice): Promise<void> {
    await this.roomConnection.sendVoiceMessage(message)
  }

  update() {
    let i = 0

    const random = +(this.params.get("random") || 1)
    const speed = +(this.params.get("speed") || 0.0001)
    const distanceFactor = +(this.params.get("distance") || 0.03)

    const pos = this.positionReader()

    const center = new Vector3(pos.positionX, pos.positionY, pos.positionZ)

    if (this.params.has("position")) {
      const [x, y] = this.params.get("position")!.split(",").map(parseFloat)
      center.set(x, 0, y).scaleInPlace(16)
      center.y = 1.6
    }

    for (const [address, peer] of this.peers) {
      i++
      const angle = Math.PI * 4 * (i / this.peers.size) + performance.now() * speed

      const target = center
        .clone()
        .subtractInPlace(new Vector3(0, 1.6, 0))
        .addInPlace(new Vector3(Math.sin(angle), 0, Math.cos(angle)).scaleInPlace(i * distanceFactor + 3))

      const distance = target.subtract(peer.position).length()
      const segment = target
        .subtract(peer.position)
        .normalize()
        .scaleInPlace(Math.min(distance, 5 + Math.random() * random))
      peer.position.addInPlace(segment)

      Packet.decode(peer.positionMessage)

      this.events.emit("position", {
        address,
        data: {
          positionX: peer.position.x,
          positionY: peer.position.y,
          positionZ: peer.position.z,
          rotationW: 1,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          index: peer.epoch++,
        },
      })

      if (Math.random() > 0.8) {
        Packet.decode(peer.profileMessage)
        this.events.emit("profileMessage", {
          address,
          data: { profileVersion: peer.epoch },
        })
      }
    }
  }

  async disconnect(_error?: Error | undefined): Promise<void> {
    clearInterval(this.tick)
  }

  send(_data: Uint8Array, _hints: SendHints): void {}

  async connect(): Promise<void> {
    await Promise.all(new Array(100).fill(0).map(() => this.spawnPeer()))
  }
}

export function backupProfile(userId: string): Avatar {
  return {
    userId,
    email: "",
    version: -1,
    hasClaimedName: false,
    ethAddress: userId,
    tutorialStep: 0,
    name: "Guest",
    description: "",
    avatar: {
      bodyShape: "urn:decentraland:off-chain:base-avatars:BaseFemale",
      skin: {
        color: {
          r: 0.4901960790157318,
          g: 0.364705890417099,
          b: 0.27843138575553894,
        },
      },
      hair: {
        color: {
          r: 0.5960784554481506,
          g: 0.37254902720451355,
          b: 0.21568627655506134,
        },
      },
      eyes: {
        color: {
          r: 0.37254902720451355,
          g: 0.2235294133424759,
          b: 0.19607843458652496,
        },
      },
      wearables: [
        "urn:decentraland:off-chain:base-avatars:f_sweater",
        "urn:decentraland:off-chain:base-avatars:f_jeans",
        "urn:decentraland:off-chain:base-avatars:bun_shoes",
        "urn:decentraland:off-chain:base-avatars:standard_hair",
        "urn:decentraland:off-chain:base-avatars:f_eyes_00",
        "urn:decentraland:off-chain:base-avatars:f_eyebrows_00",
        "urn:decentraland:off-chain:base-avatars:f_mouth_00",
      ],
      snapshots: {
        face256: `QmZbyGxDnZ4PaMVX7kpA2NuGTrmnpwTJ8heKKTSCk4GRJL`,
        body: `QmaQvcBWg57Eqf5E9R3Ts1ttPKKLhKueqdyhshaLS1tu2g`,
      },
    },
  }
}
