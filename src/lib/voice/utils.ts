import * as rfc4 from "@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen"
import { Quaternion, Vector3 } from "@dcl/ecs-math"

export function setListenerParams(audioContext: AudioContext, listener: AudioListener, position: rfc4.Position) {
  const orientation = Vector3.Backward().rotate(
    Quaternion.FromArray([position.rotationX, position.rotationY, position.rotationZ, position.rotationW])
  )

  if (listener.positionX) {
    listener.positionX.setValueAtTime(position.positionX, audioContext.currentTime)
    listener.positionY.setValueAtTime(position.positionY, audioContext.currentTime)
    listener.positionZ.setValueAtTime(position.positionZ, audioContext.currentTime)
  } else {
    listener.setPosition(position.positionX, position.positionY, position.positionZ)
  }

  if (listener.forwardX) {
    listener.forwardX.setValueAtTime(orientation[0], audioContext.currentTime)
    listener.forwardY.setValueAtTime(orientation[1], audioContext.currentTime)
    listener.forwardZ.setValueAtTime(orientation[2], audioContext.currentTime)
    listener.upX.setValueAtTime(0, audioContext.currentTime)
    listener.upY.setValueAtTime(1, audioContext.currentTime)
    listener.upZ.setValueAtTime(0, audioContext.currentTime)
  } else {
    listener.setOrientation(orientation[0], orientation[1], orientation[2], 0, 1, 0)
  }
}


export function setPanNodeParams(audioContext: AudioContext, panNode: PannerNode, position: rfc4.Position) {
  if (panNode.positionX) {
    panNode.positionX.setValueAtTime(position.positionX, audioContext.currentTime)
    panNode.positionY.setValueAtTime(position.positionY, audioContext.currentTime)
    panNode.positionZ.setValueAtTime(position.positionZ, audioContext.currentTime)
  } else {
    panNode.setPosition(position.positionX, position.positionY, position.positionZ)
  }

  if (panNode.orientationX) {
    panNode.orientationX.setValueAtTime(0, audioContext.currentTime)
    panNode.orientationY.setValueAtTime(0, audioContext.currentTime)
    panNode.orientationZ.setValueAtTime(1, audioContext.currentTime)
  } else {
    panNode.setOrientation(0, 0, 1)
  }
}

export function isChrome() {
  return window.navigator.userAgent.includes("Chrome")
}
