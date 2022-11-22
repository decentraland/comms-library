import mitt from "mitt"
import { CommsEvents } from "./interface"

export type CommsPerformanceEvent = { value: number }
export type CommsPerformanceEvents = Record<keyof CommsEvents, CommsPerformanceEvent> & {
  bytesIn: CommsPerformanceEvent
  bytesOut: CommsPerformanceEvent

  messagesIn: CommsPerformanceEvent
  messagesOut: CommsPerformanceEvent
}

/**
 * @deprecated
 * This should not be used for business logic. It only exists for debugging porpuses
 */
export const commsPerfObservable = mitt<CommsPerformanceEvents>()

export function incrementCommsMessageReceivedByName(event: keyof CommsPerformanceEvents, value: number = 1) {
  commsPerfObservable.emit(event, { value })
}
