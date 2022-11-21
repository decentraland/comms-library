import * as rfc4 from '@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen'

export type PackageType = keyof rfc4.Packet

export type Package<T> = {
  address: string
  data: T
}
