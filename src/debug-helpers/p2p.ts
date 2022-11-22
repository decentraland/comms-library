import mitt from "mitt"
import { TopologyParams } from "../lib/interface"

export type TopologyEvents = {
  changed: Map<string, Map<string, TopologyParams>>
}

export const topologyEvents = mitt<TopologyEvents>()
export function updateTopology(topology: Map<string, Map<string, TopologyParams>>) {
  topologyEvents.emit('changed', topology)
}

export function clearGraph() {
  topologyEvents.emit('changed', new Map)
}
