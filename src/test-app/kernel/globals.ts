import { Position } from "@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen"
import { Observable } from "mz-observable"

export let lastPosition: Position = {
  index: 0,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationW: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
}
export const positionObservable = new Observable<Position>()

positionObservable.add((x) => {
  lastPosition = x
})