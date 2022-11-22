import * as rfc4 from "@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen"
import { CommsEvents, RoomConnection, TopologyParams } from "../interface"
import mitt from "mitt"
import { AdapterMessageEvent, MinimumCommunicationsAdapter } from "../adapters/types"
import { VoiceHandler } from "../types"
import { incrementCommsMessageReceivedByName } from "../performance"

/**
 * This class implements Rfc4 on top of a ICommsTransport. The idea behind it is
 * to serve as a reference implementation for comss. ICommsTransport can be an IRC
 * server, an echo server, a mocked implementation or WebSocket among many others.
 */
export class Rfc4RoomConnection implements RoomConnection {
  events = mitt<CommsEvents>()

  private positionIndex: number = 0

  constructor(private transport: MinimumCommunicationsAdapter) {
    this.transport.events.on("message", this.handleMessage.bind(this))
    this.transport.events.on("DISCONNECTION", (event) => this.events.emit("DISCONNECTION", event))
    this.transport.events.on("PEER_DISCONNECTED", (event) => this.events.emit("PEER_DISCONNECTED", event))
    this.transport.events.on("PEER_CONNECTED", (event) => this.events.emit("PEER_CONNECTED", event))
  }

  getDebugTopology(): Map<string, Map<string, TopologyParams>> {
    return new Map
  }

  async connect(): Promise<void> {
    await this.transport.connect()
  }

  getVoiceHandler(): Promise<VoiceHandler> {
    return this.transport.getVoiceHandler((frame) => this.sendVoiceMessage(frame))
  }

  sendPositionMessage(p: Omit<rfc4.Position, "index">): Promise<void> {
    return this.sendMessage(false, {
      message: {
        $case: "position",
        position: {
          ...p,
          index: this.positionIndex++,
        },
      },
    })
  }
  sendParcelSceneMessage(scene: rfc4.Scene): Promise<void> {
    return this.sendMessage(false, { message: { $case: "scene", scene } })
  }
  sendProfileMessage(profileVersion: rfc4.AnnounceProfileVersion): Promise<void> {
    return this.sendMessage(true, { message: { $case: "profileVersion", profileVersion } })
  }
  sendProfileRequest(profileRequest: rfc4.ProfileRequest): Promise<void> {
    return this.sendMessage(true, { message: { $case: "profileRequest", profileRequest } })
  }
  sendProfileResponse(profileResponse: rfc4.ProfileResponse): Promise<void> {
    return this.sendMessage(true, { message: { $case: "profileResponse", profileResponse } })
  }
  sendChatMessage(chat: rfc4.Chat): Promise<void> {
    return this.sendMessage(true, { message: { $case: "chat", chat } })
  }
  sendVoiceMessage(voice: rfc4.Voice): Promise<void> {
    return this.sendMessage(false, { message: { $case: "voice", voice } })
  }

  async disconnect() {
    await this.transport.disconnect()
    this.events.all.clear()
  }

  private handleMessage({ data, address }: AdapterMessageEvent) {
    incrementCommsMessageReceivedByName("bytesIn", data.length)
    incrementCommsMessageReceivedByName("messagesIn", 1)

    const { message } = rfc4.Packet.decode(data)

    if (!message) {
      return
    }

    switch (message.$case) {
      case "position": {
        this.events.emit("position", { address, data: message.position })
        break
      }
      case "scene": {
        this.events.emit("sceneMessageBus", { address, data: message.scene })
        break
      }
      case "chat": {
        this.events.emit("chatMessage", { address, data: message.chat })
        break
      }
      case "voice": {
        this.events.emit("voiceMessage", { address, data: message.voice })
        break
      }
      case "profileRequest": {
        this.events.emit("profileRequest", {
          address,
          data: message.profileRequest,
        })
        break
      }
      case "profileResponse": {
        this.events.emit("profileResponse", {
          address,
          data: message.profileResponse,
        })
        break
      }
      case "profileVersion": {
        this.events.emit("profileMessage", {
          address,
          data: message.profileVersion,
        })
        break
      }
    }
  }

  private async sendMessage(reliable: boolean, topicMessage: rfc4.Packet) {
    if (Object.keys(topicMessage).length === 0) {
      throw new Error("Invalid message")
    }
    const bytes = rfc4.Packet.encode(topicMessage as any).finish()
    if (!this.transport) debugger
    incrementCommsMessageReceivedByName("bytesOut", bytes.length)
    incrementCommsMessageReceivedByName("messagesOut", 1)
    this.transport.send(bytes, { reliable })
  }
}
