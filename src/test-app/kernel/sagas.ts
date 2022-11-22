import { Position } from "@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen"
import { put, take, takeEvery } from "redux-saga/effects"
import { ErrorConnectingCommsAdapterAction, ERROR_CONNECTING_COMMS_ADAPTER, setRoomConnection } from "../../lib/actions"
import { RoomConnection } from "../../lib/interface"
import { BEFORE_UNLOAD, FATAL_ERROR } from "./actions"
import { positionObservable } from "./globals"
import { deepEqual } from "./helpers"

// the functions in this file should be implemented by kernel
export function* kernelSagas() {
  // MIGRATE:
  yield takeEvery(ERROR_CONNECTING_COMMS_ADAPTER, (errAction: ErrorConnectingCommsAdapterAction) => {
    // notifyStatusThroughChat('Error connecting to comms. Will try another realm')
    console.error("ERROR CONNECTING COMMS", errAction.payload.error)
  })

  // MIGRATE:
  yield takeEvery([BEFORE_UNLOAD, FATAL_ERROR], function* () {
    // this would disconnect the comms context
    yield put(setRoomConnection(undefined))
  })
}

/**
 * This saga reports the position of our player:
 * - once every one second
 * - and every time a positionObservable is called with a maximum of 10Hz
 */
function* reportPositionSaga() {
  let latestRoom: RoomConnection | undefined = undefined

  let lastNetworkUpdatePosition = 0
  let lastPositionSent: Position

  const observer = positionObservable.add((newPosition: Readonly<Position>) => {
    if (latestRoom) {
      const now = Date.now()
      const elapsed = now - lastNetworkUpdatePosition

      // We only send the same position message as a ping if we have not sent positions in the last 1 second
      if (elapsed < 1000) {
        if (deepEqual(newPosition, lastPositionSent)) {
          return
        }
      }

      // Otherwise we simply respect the 10Hz
      if (elapsed > 100) {
        lastPositionSent = newPosition
        lastNetworkUpdatePosition = now
        latestRoom.sendPositionMessage(newPosition).catch((e) => {
          // MIGRATE: incrementCounter('failed:sendPositionMessage')
          console.warn(`error while sending message `, e)
          debugger
        })
      }
    }
  })

  // wait for program to shutdown
  yield take(BEFORE_UNLOAD)

  // then remove global listener
  positionObservable.remove(observer)
}
