import { Position3D } from "@dcl/catalyst-peer"
import { Authenticator } from "@dcl/crypto"
import mitt from "mitt"
import { Rfc4RoomConnection } from "../logic/rfc-4-room-connection"
import { TransportCreator } from "../types"
import { LighthouseConnectionConfig, LighthouseWorldInstanceConnection } from "../v2/LighthouseWorldInstanceConnection"
import { LivekitAdapter } from "./LivekitAdapter"
import { OfflineAdapter } from "./OfflineAdapter"
import { PeerToPeerAdapter } from "./PeerToPeerAdapter"
import { SimulationRoom } from "./SimulatorAdapter"
import { WebSocketAdapter } from "./WebSocketAdapter"

export function splitConnectionString(connectionString: string) {
  const ix = connectionString.indexOf(":")
  const protocol = connectionString.substring(0, ix)
  const url = connectionString.substring(ix + 1)
  return [protocol, url]
}

export const transportCrators: Record<string, TransportCreator> = {
  async ["ws-room"](params) {
    const [, url] = splitConnectionString(params.connectionString)
    const finalUrl = !url.startsWith("ws:") && !url.startsWith("wss:") ? "wss://" + url : url

    return new Rfc4RoomConnection(new WebSocketAdapter(finalUrl, params.identity, params.logger))
  },
  async ["simulator"](params) {
    const [, url] = splitConnectionString(params.connectionString)
    return new SimulationRoom(url, params.positionReader)
  },
  async ["offline"](_params) {
    return new Rfc4RoomConnection(new OfflineAdapter())
  },
  async ["livekit"](params) {
    const [, url] = splitConnectionString(params.connectionString)
    const theUrl = new URL(url)
    const token = theUrl.searchParams.get("access_token")
    if (!token) {
      throw new Error("No access token")
    }
    return new Rfc4RoomConnection(
      new LivekitAdapter({
        logger: params.logger,
        url: theUrl.origin + theUrl.pathname,
        token,
      })
    )
  },
  async ["p2p"](params) {
    const peers = new Map<string, Position3D>()
    const adapter = new PeerToPeerAdapter(
      {
        logger: params.logger,
        positionReader: params.positionReader,
        topicsService: null as any,
        logConfig: {
          debugWebRtcEnabled: true,
          debugUpdateNetwork: true,
          debugIceCandidates: true,
          debugMesh: true,
        },
        relaySuspensionConfig: {
          relaySuspensionInterval: 750,
          relaySuspensionDuration: 5000,
        },
        islandId: params.islandId,
        peerId: params.identity.authChain[0].payload,
      },
      peers
    )
    return new Rfc4RoomConnection(adapter)
  },
  async ["lighthouse"](params) {
    const [, url] = splitConnectionString(params.connectionString)
    const peerConfig: LighthouseConnectionConfig = {
      connectionConfig: {
        // MIGRATE: iceServers: [],
      },
      authHandler: async (msg: string) => {
        try {
          return Authenticator.signPayload(params.identity, msg)
        } catch (e) {
          params.logger.info(`error while trying to sign message from lighthouse '${msg}'`)
        }
        // if any error occurs
        return []
      },
      logLevel: "INFO",
      targetConnections: 4,
      maxConnections: 6,
      positionConfig: {
        selfPosition: () => {
          const position = params.positionReader()
          return [position.positionX, position.positionY, position.positionZ]
        },
        maxConnectionDistance: 4,
        nearbyPeersDistance: 5,
        disconnectDistance: 6,
      },
      preferedIslandId: params.islandId,
    }

    peerConfig.relaySuspensionConfig = {
      relaySuspensionInterval: 750,
      relaySuspensionDuration: 5000,
    }

    const lighthouse = new LighthouseWorldInstanceConnection(
      params.positionReader,
      url,
      peerConfig,
      (status) => {
        // TODO: move this code inside instance
        params.logger.log("Lighthouse status: ", status)
        switch (status.status) {
          case "realm-full":
            disconnect(status.status, "The realm is full, reconnecting")
            break
          case "reconnection-error":
            disconnect(status.status, "Reconnection comms error")
            break
          case "id-taken":
            disconnect(status.status, "A previous connection to the connection server is still active")
            break
          case "error":
            disconnect(status.status, "An error has ocurred in the communications server, reconnecting.")
            break
        }
      },
      params.identity,
      params.logger
    )

    function disconnect(reason: string, message: string) {
      /* MIGRATE: getUnityInstance().ShowNotification({
        type: NotificationType.GENERIC,
        message: message,
        buttonMessage: 'OK',
        timer: 10
      })*/

      lighthouse
        .disconnect({ kicked: reason === "id-taken", error: new Error(message) })
        .catch(params.logger.error)
    }

    lighthouse.onIslandChangedObservable.add(({ island }) => {
      // MIGRATE: store.dispatch(setCommsIsland(island))
    })

    return lighthouse
  },
}
