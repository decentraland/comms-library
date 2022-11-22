import { TopologyParams } from "../lib/interface"
import { P2PGraph } from "./p2p-graph"

export const graph = new P2PGraph(".p2p-graph")

export function initP2pGraph() {
  graph.events.on("select", function (id) {
    console.log(id + " selected!")
  })
}

export function updateTopology(topology: Map<string, Map<string, TopologyParams>>) {
  queueMicrotask(() => {
    for (const [source, targets] of topology) {
      if (!graph.hasPeer(source))
        graph.add({
          id: source,
          name: source,
        })
      for (const [target] of targets) {
        if (!graph.hasPeer(target))
          graph.add({
            id: target,
            name: target,
          })
      }
    }

    // remove extra
    for (const link of graph._model.links) {
      if (!topology.get(link.source.id)?.has(link.target.id)) {
        graph.disconnect(link.source.id, link.target.id)
      }
    }
    // add missing
    for (const [source, targets] of topology) {
      for (const [target, data] of targets) {
        if (!graph.hasLink(source, target)) {
          graph.connect(source, target, data)
        }
      }
    }
  })
}

export function clearGraph() {
  for (const node of graph._model.nodes) {
    graph.remove(node.id)
  }
}
