import * as rfc4 from '@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen'

export const MORDOR_POSITION_RFC4: rfc4.Position = {
  positionX: 1000 * 16,
  positionY: 1000,
  positionZ: 1000 * 16,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  rotationW: 1,
  index: 0
}


export namespace parcelLimits {
  export const parcelSize = 16 /* meters */
  export const halfParcelSize = parcelSize / 2 /* meters */
  export const centimeter = 0.01

  // eslint-disable-next-line prefer-const
  export let visibleRadius = 4

  /**
   * @deprecated. This is still used to calculate a position hash, but shouln't be used for anything else.
   */
  export const maxParcelX = 150
  /** @deprecated */
  export const maxParcelZ = 150
  /** @deprecated */
  export const minParcelX = -150
  /** @deprecated */
  export const minParcelZ = -150
}
