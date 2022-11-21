import * as rfc4 from '@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen'
import { Quaternion, Vector3 } from '@dcl/ecs-math'

export type VoiceSpatialParams = {
  position: [number, number, number]
  orientation: [number, number, number]
}

export function getSpatialParamsFor(position: rfc4.Position): VoiceSpatialParams {
  const orientation = Vector3.Backward().rotate(
    Quaternion.FromArray([position.rotationX, position.rotationY, position.rotationZ, position.rotationW])
  )

  return {
    position: [position.positionX, position.positionY, position.positionZ],
    orientation: [orientation.x, orientation.y, orientation.z]
  }
}

export function isChrome() {
  return window.navigator.userAgent.includes('Chrome')
}
