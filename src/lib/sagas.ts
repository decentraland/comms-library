import { put, takeEvery, select, call, takeLatest, fork, take, race, delay, apply } from "redux-saga/effects"
import { commsLogger } from "./context"
import {
  getCommsIdentity,
  getCommsRoom,
  getCurrentCommsProfile,
  getCurrentCommsProfileBaseUrl,
  getCurrentPositionReader,
} from "./selectors"
import {
  commsEstablished,
  ConnectToCommsAction,
  CONNECT_TO_COMMS,
  establishingComms,
  HandleRoomDisconnectionAction,
  HANDLE_ROOM_DISCONNECTION,
  setCommsIsland,
  setRoomConnection,
  SetRoomConnectionAction,
  SET_COMMS_ISLAND,
  SET_COMMS_PROFILE,
  SET_ROOM_CONNECTION,
} from "./actions"
import { Rfc4RoomConnection } from "./logic/rfc-4-room-connection"
import { Avatar, IPFSv2, Snapshots } from "@dcl/schemas"
import * as rfc4 from "@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen"
import { OfflineAdapter } from "./adapters/OfflineAdapter"
import { WebSocketAdapter } from "./adapters/WebSocketAdapter"
import { LivekitAdapter } from "./adapters/LivekitAdapter"
import { PeerToPeerAdapter } from "./adapters/PeerToPeerAdapter"
import { SimulationRoom } from "./adapters/SimulatorAdapter"
import { Authenticator } from "@dcl/crypto"
import { LighthouseConnectionConfig, LighthouseWorldInstanceConnection } from "./v2/LighthouseWorldInstanceConnection"
import { RoomConnection } from "./interface"
import { CommsIdentity, PositionReader } from "./types"
import { Position3D } from "@dcl/catalyst-peer"

const TIME_BETWEEN_PROFILE_RESPONSES = 1000
const INTERVAL_ANNOUNCE_PROFILE = 1000

export const genericAvatarSnapshots = {
  body: "QmSav1o6QK37Jj1yhbmhYk9MJc6c2H5DWbWzPVsg9JLYfF",
  face256: "QmSqZ2npVD4RLdqe17FzGCFcN29RfvmqmEd2FcQUctxaKk",
} as const

export function* commsSaga() {
  yield takeLatest(HANDLE_ROOM_DISCONNECTION, handleRoomDisconnectionSaga)

  // MIGRATE: yield takeEvery(FATAL_ERROR, function* () {
  // MIGRATE:   // set null context on fatal error. this will bring down comms.
  // MIGRATE:   yield put(setRoomConnection(undefined))
  // MIGRATE: })

  // MIGRATE: yield takeEvery(BEFORE_UNLOAD, function* () {
  // MIGRATE:   // this would disconnect the comms context
  // MIGRATE:   yield put(setRoomConnection(undefined))
  // MIGRATE: })

  yield takeEvery(CONNECT_TO_COMMS, handleConnectToComms)

  yield fork(handleNewCommsContext)

  // respond to profile requests over comms
  yield fork(respondCommsProfileRequests)

  yield fork(handleAnnounceProfile)
  // MIGRATE: yield fork(initAvatarVisibilityProcess)
  // MIGRATE: yield fork(handleCommsReconnectionInterval)
  // MIGRATE: yield fork(pingerProcess)
  yield fork(reportPositionSaga)

  // MIGRATE: if (COMMS_GRAPH) {
  // MIGRATE:   yield call(debugCommsGraph)
  // MIGRATE: }
}

/**
 * This saga reports the position of our player:
 * - once every one second
 * - or when a new comms context is set
 */
function* reportPositionSaga() {
  let latestRoom: RoomConnection | undefined = undefined

  while (true) {
    const reason = yield race({
      // MIGRATE: UNLOAD: take(BEFORE_UNLOAD),
      // MIGRATE: ERROR: take(FATAL_ERROR),
      timeout: delay(1000),
      SET_ROOM_CONNECTION: take(SET_ROOM_CONNECTION),
    })

    if (reason.UNLOAD || reason.ERROR) break

    latestRoom = yield select(getCommsRoom)

    const positionReader: PositionReader | undefined = yield select(getCurrentPositionReader)

    if (latestRoom && positionReader) {
      try {
        yield latestRoom.sendPositionMessage(positionReader())
      } catch (err: any) {
        console.error(err)
        debugger
      }
    }
  }
}

// /**
//  * This saga sends random pings to all peers if the conditions are met.
//  */
// function* pingerProcess() {
//   while (true) {
//     yield delay(15_000 + Math.random() * 60_000)

//     const responses = new Map<string, number[]>()
//     const expectedResponses = getAllPeers().size

//     yield call(sendPing, (dt, address) => {
//       const list = responses.get(address) || []
//       responses.set(address, list)
//       list.push(dt)
//       // MIGRATE: measurePingTime(dt)
//       if (list.length > 1) {
//         // MIGRATE: incrementCounter("pong_duplicated_response_counter")
//       }
//     })

//     yield delay(15_000)

//     // measure the response ratio
//     if (expectedResponses) {
//       // MIGRATE:  measurePingTimePercentages(Math.round((responses.size / expectedResponses) * 100))
//     }

//     // MIGRATE: incrementCounter('pong_expected_counter', expectedResponses)
//     // MIGRATE: incrementCounter('pong_given_counter', responses.size)
//   }
// }

/**
 * This saga handles the action to connect a specific comms
 * adapter.
 */
function* handleConnectToComms(action: ConnectToCommsAction) {
  try {
    const identity: CommsIdentity = yield select(getCommsIdentity)
    const positionReader: PositionReader | undefined = yield select(getCurrentPositionReader)
    if (!positionReader) throw new Error("Missing positionReader")

    const ix = action.payload.event.connStr.indexOf(":")
    const protocol = action.payload.event.connStr.substring(0, ix)
    const url = action.payload.event.connStr.substring(ix + 1)

    yield put(setCommsIsland(action.payload.event.islandId))

    let adapter: RoomConnection | undefined = undefined

    switch (protocol) {
      case "offline": {
        adapter = new Rfc4RoomConnection(new OfflineAdapter())
        break
      }
      case "ws-room": {
        const finalUrl = !url.startsWith("ws:") && !url.startsWith("wss:") ? "wss://" + url : url

        // TODO console
        adapter = new Rfc4RoomConnection(new WebSocketAdapter(finalUrl, identity, console))
        break
      }
      case "simulator": {
        adapter = new SimulationRoom(url, positionReader)
        break
      }
      case "livekit": {
        const theUrl = new URL(url)
        const token = theUrl.searchParams.get("access_token")
        if (!token) {
          throw new Error("No access token")
        }
        adapter = new Rfc4RoomConnection(
          new LivekitAdapter({
            logger: commsLogger,
            url: theUrl.origin + theUrl.pathname,
            token,
          })
        )
        break
      }
      case "p2p": {
        adapter = new Rfc4RoomConnection(yield call(createP2PAdapter, action.payload.event.islandId))
        break
      }
      case "lighthouse": {
        adapter = yield call(createLighthouseConnection, url)
        break
      }
    }

    if (!adapter) throw new Error(`A communications adapter could not be created for protocol=${protocol}`)
    ;(globalThis as any).__DEBUG_ADAPTER = adapter

    yield put(establishingComms())
    yield apply(adapter, adapter.connect, [])
    yield put(setRoomConnection(adapter))
  } catch (error: any) {
    // MIGRATE: notifyStatusThroughChat('Error connecting to comms. Will try another realm')
    // MIGRATE: yield put(setRealmAdapter(undefined))
    yield put(setRoomConnection(undefined))
  }
}

function* createP2PAdapter(islandId: string) {
  const identity: CommsIdentity = yield select(getCommsIdentity)
  const positionReader: PositionReader | undefined = yield select(getCurrentPositionReader)
  if (!positionReader) throw new Error("Missing positionReader")
  const peers = new Map<string, Position3D>()
  // for (const [id, p] of Object.entries(islandChangedMessage.peers)) {
  //   if (peerId !== id) {
  //     peers.set(id, [p.x, p.y, p.z])
  //   }
  // }
  return new PeerToPeerAdapter(
    {
      logger: commsLogger,
      positionReader,
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
      islandId,
      // TODO: is this peerId correct?
      peerId: identity.authChain[0].payload,
    },
    peers
  )
}

function* createLighthouseConnection(url: string) {
  const identity: CommsIdentity = yield select(getCommsIdentity)
  const positionReader: PositionReader | undefined = yield select(getCurrentPositionReader)
  if (!positionReader) throw new Error("Missing positionReader")
  const peerConfig: LighthouseConnectionConfig = {
    connectionConfig: {
      // MIGRATE: iceServers: [],
    },
    authHandler: async (msg: string) => {
      try {
        return Authenticator.signPayload(identity, msg)
      } catch (e) {
        commsLogger.info(`error while trying to sign message from lighthouse '${msg}'`)
      }
      // if any error occurs
      return identity
    },
    logLevel: "TRACE",
    targetConnections: 4,
    maxConnections: 6,
    positionConfig: {
      selfPosition: () => {
        const position = positionReader()
        return [position.positionX, position.positionY, position.positionZ]
      },
      maxConnectionDistance: 4,
      nearbyPeersDistance: 5,
      disconnectDistance: 6,
    },
    // MIGRATE: add PREFERRED_ISLAND to action
    preferedIslandId: "",
  }

  peerConfig.relaySuspensionConfig = {
    relaySuspensionInterval: 750,
    relaySuspensionDuration: 5000,
  }

  const lighthouse = new LighthouseWorldInstanceConnection(
    url,
    peerConfig,
    (status) => {
      commsLogger.log("Lighthouse status: ", status)
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
    identity,
    console
  )

  function disconnect(reason: string, message: string) {
    // TODO: trackEvent('disconnect_lighthouse', { message, reason, url })

    /* TODO: getUnityInstance().ShowNotification({
      type: NotificationType.GENERIC,
      message: message,
      buttonMessage: 'OK',
      timer: 10
    })*/

    lighthouse
      .disconnect({ kicked: reason === "id-taken", error: new Error(message) })
      .catch(commsLogger.error)
      .finally(() => {
        setTimeout(
          () => {
            // MIGRATE: store.dispatch(setRealmAdapter(undefined))
            // MIGRATE: store.dispatch(setRoomConnection(undefined))
          },
          reason === "id-taken" ? 10000 : 300
        )
      })
  }

  lighthouse.onIslandChangedObservable.add(({ island }) => {
    // MIGRATE: store.dispatch(setCommsIsland(island))
  })

  return lighthouse
}

// MIGRATE: function* initAvatarVisibilityProcess()

/**
 * This handler sends profile responses over comms.
 */
function* respondCommsProfileRequests() {
  let lastMessage = 0

  while (true) {
    // wait for the next event of the channel
    yield take(SET_COMMS_PROFILE)

    const context = (yield select(getCommsRoom)) as RoomConnection | undefined
    const profile: Avatar | null = yield select(getCurrentCommsProfile)
    const contentServer: string | undefined = yield select(getCurrentCommsProfileBaseUrl)
    const identity: CommsIdentity | null = yield select(getCommsIdentity)

    if (profile && context && contentServer) {
      profile.hasConnectedWeb3 = identity?.hasConnectedWeb3 || profile.hasConnectedWeb3

      // naive throttling
      const now = Date.now()
      const elapsed = now - lastMessage
      if (elapsed < TIME_BETWEEN_PROFILE_RESPONSES) continue
      lastMessage = now

      const response: rfc4.ProfileResponse = {
        serializedProfile: JSON.stringify(stripSnapshots(profile)),
        baseUrl: contentServer,
      }

      yield apply(context, context.sendProfileResponse, [response])
    }
  }
}

function stripSnapshots(profile: Avatar): Avatar {
  const newSnapshots: Record<string, string> = {}
  const currentSnapshots: Record<string, string> = profile.avatar.snapshots

  for (const snapshotKey of ["face256", "body"] as const) {
    const snapshot = currentSnapshots[snapshotKey]
    const defaultValue = genericAvatarSnapshots[snapshotKey]
    const newValue =
      snapshot &&
      (snapshot.startsWith("/") ||
        snapshot.startsWith("./") ||
        snapshot.startsWith("https://") ||
        IPFSv2.validate(snapshot))
        ? snapshot
        : null
    newSnapshots[snapshotKey] = newValue || defaultValue
  }

  return {
    ...profile,
    avatar: { ...profile.avatar, snapshots: newSnapshots as Snapshots },
  }
}

/**
 * This saga waits for one of the conditions that may trigger a
 * sendCurrentProfile and then does it.
 */
function* handleAnnounceProfile() {
  while (true) {
    yield race({
      // MIGRATE: SEND_PROFILE_TO_RENDERER: take(SEND_PROFILE_TO_RENDERER),
      // MIGRATE: DEPLOY_PROFILE_SUCCESS: take(DEPLOY_PROFILE_SUCCESS),
      SET_COMMS_PROFILE: take(SET_COMMS_PROFILE),
      SET_COMMS_ISLAND: take(SET_COMMS_ISLAND),
      timeout: delay(INTERVAL_ANNOUNCE_PROFILE),
      SET_WORLD_CONTEXT: take(SET_ROOM_CONNECTION),
    })

    const roomConnection: RoomConnection | undefined = yield select(getCommsRoom)
    const profile: Avatar | null = yield select(getCurrentCommsProfile)

    if (roomConnection && profile) {
      roomConnection.sendProfileMessage({ profileVersion: profile.version }).catch(commsLogger.error)
    }
  }
}

// this saga reacts to changes in context and disconnects the old context
export function* handleNewCommsContext() {
  let oldRoomConnection: RoomConnection | undefined = undefined

  while (true) {
    const action: SetRoomConnectionAction = yield take(SET_ROOM_CONNECTION)
    const newRoomConnection = action.payload

    if (oldRoomConnection !== newRoomConnection) {
      if (newRoomConnection) {
        // bind messages to this comms instance
        // MIGRATE: yield call(bindHandlersToCommsContext, newRoomConnection)
        yield put(commsEstablished())
      }

      if (oldRoomConnection) {
        // disconnect previous context
        yield call(disconnectRoom, oldRoomConnection)
      }

      // lastly, replace the state of this saga
      oldRoomConnection = newRoomConnection
    }
  }
}

export async function disconnectRoom(context: RoomConnection) {
  try {
    await context.disconnect()
  } catch (err: any) {
    // this only needs to be logged. try {} catch is used because the function needs
    // to wait for the disconnection to continue with the saga.
    commsLogger.error(err)
  }
}

// this saga handles the suddenly disconnection of a CommsContext
function* handleRoomDisconnectionSaga(action: HandleRoomDisconnectionAction) {
  const room: RoomConnection = yield select(getCommsRoom)

  if (room && room === action.payload.context) {
    // this also remove the context
    yield put(setRoomConnection(undefined))

    // MIGRATE: if (action.payload.context) {
    // MIGRATE:   notifyStatusThroughChat(`Lost connection to realm`)
    // MIGRATE: }
  }
}
