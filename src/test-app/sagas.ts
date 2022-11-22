import { fork, select, takeEvery } from "redux-saga/effects"
import { clearGraph, graph, updateTopology } from "../debug-helpers/p2p"
import { CommsIdentity, getCommsIdentity, getCommsRoom, SET_ROOM_CONNECTION } from "../lib"
import { RoomConnection } from "../lib/interface"
import { commsSaga } from "../lib/sagas"

export function* rootSaga() {
  yield fork(commsSaga)
  yield takeEvery(SET_ROOM_CONNECTION, function* () {
    const room: RoomConnection = yield select(getCommsRoom)
    if (!room) return
    clearGraph()
    const identity: CommsIdentity = yield select(getCommsIdentity)
    const me = identity.authChain[0].payload
    graph.add({
      id: me,
      me: true,
      name: "Me",
    })

    room.events.on("PEER_CONNECTED", (evt) => {
      graph.add({
        id: evt.address,
        name: evt.address.substr(0,8) + '...' + evt.address.substr(-6),
      })
      updateTopology(room.getDebugTopology())
    })

    room.events.on("PEER_DISCONNECTED", (evt) => {
      graph.remove(evt.address)
      updateTopology(room.getDebugTopology())
    })

    room.events.on("PEER_LINKED", evt => {
      updateTopology(room.getDebugTopology())
    })

    room.events.on("PEER_UNLINKED", evt => {
      updateTopology(room.getDebugTopology())
    })
  })
}
