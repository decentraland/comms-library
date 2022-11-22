import d3 from "d3"
import mitt from "mitt"
const debug = require("debug")("p2p-graph")
const throttle = require("throttleit")

const STYLE = {
  links: {
    width: 0.7, // default link thickness
    maxWidth: 5.0, // max thickness
    maxBytes: 2097152, // link max thickness at 2MB
  },
}

const COLORS = {
  links: {
    color: "#C8C8C8",
  },
  text: {
    subtitle: "#C8C8C8",
  },
  nodes: {
    method: function (d, i) {
      return d.me
        ? d3.hsl(210, 0.7, 0.725) // blue
        : d.seeder
        ? d3.hsl(120, 0.7, 0.725) // green
        : d3.hsl(55, 0.7, 0.725) // yellow
    },
    hover: "#A9A9A9",
    dep: "#252929",
  },
}

type ID = string

interface LinkData {
  rate: number
  hops: number
}

interface Link extends LinkData {
  source: d3.layout.force.Node & GraphNode
  target: d3.layout.force.Node & GraphNode
}

interface GraphNode {
  index?: any
  id: ID
  seeder?: boolean
  active?: boolean
  me?: boolean
  name: string
}

export class P2PGraph {
  _root: HTMLElement
  _model: { nodes: GraphNode[]; links: Link[]; focused: GraphNode | null }
  _svg: d3.Selection<any>
  _force: d3.layout.Force<
    Link & d3.layout.force.Link<d3.layout.force.Node & GraphNode>,
    d3.layout.force.Node & GraphNode
  >
  _width: any
  _height: any
  _node: d3.selection.Update<d3.layout.force.Node & GraphNode>
  _link: d3.selection.Update<Link>
  _resizeThrottled: any

  events = mitt()

  constructor(root: HTMLElement | string) {
    if (typeof root === "string") this._root = document.querySelector(root)!
    else this._root = root

    this._model = {
      nodes: [],
      links: [],
      focused: null,
    }

    this._svg = d3.select(this._root).append("svg")

    this._resize()

    this._force = d3.layout
      .force()
      .size([this._width, this._height])
      .nodes(this._model.nodes as any)
      .links(this._model.links as any)
      .on("tick", () => {
        this._link
          .attr("x1", (d) => {
            return d.source.x!
          })
          .attr("y1", (d) => {
            return d.source.y!
          })
          .attr("x2", (d) => {
            return d.target.x!
          })
          .attr("y2", (d) => {
            return d.target.y!
          })

        this._node
          .attr("cx", (d) => {
            return d.x!
          })
          .attr("cy", (d) => {
            return d.y!
          })

        this._node.attr("transform", (d) => {
          return "translate(" + d.x + "," + d.y + ")"
        })
      }) as any

    this._node = this._svg.selectAll(".node").data([] as any)
    this._link = this._svg.selectAll(".link").data([] as any)

    this._update()

    this._resizeThrottled = throttle(() => {
      this._resize()
    }, 500)
    window.addEventListener("resize", this._resizeThrottled)
  }

  list() {
    debug("list")
    return this._model.nodes
  }

  add(node: GraphNode) {
    debug("add %s %o", node.id, node)
    if (this._getNode(node.id)) {
      console.error("add: cannot add duplicate node: " + node.id)
    } else {
      this._model.nodes.push(node)
      this._update()
    }
  }

  remove(id: ID) {
    debug("remove %s", id)
    const index = this._getNodeIndex(id)
    if (index === -1) {
      console.error(new Error("remove: node does not exist"))
      return
    }

    if (this._model.focused && this._model.focused.id === id) {
      this._model.focused = null
      this.events.emit("select", null)
    }

    this._model.nodes.splice(index, 1)
    this._update()
  }

  connect(sourceId: ID, targetId: ID, data: Partial<LinkData>) {
    debug("connect %s %s", sourceId, targetId)

    const sourceNode = this._getNode(sourceId)
    if (!sourceNode) {
      console.error(new Error("connect: invalid source id: " + sourceId))
      return
    }
    const targetNode = this._getNode(targetId)
    if (!targetNode) {
      console.error(new Error("connect: invalid target id: " + targetId))
      return
    }

    const link = this.getLink(sourceNode.index, targetNode.index)

    if (link) {
      Object.assign(link.rate, data)
    } else {
      this._model.links.push({
        source: sourceNode.index,
        target: targetNode.index,
        rate: 0,
        hops: 0,
        ...data,
      })
    }

    this._update()
  }

  disconnect(sourceId: ID, targetId: ID) {
    debug("disconnect %s %s", sourceId, targetId)

    const sourceNode = this._getNode(sourceId)
    if (!sourceNode) {
      console.error(new Error("disconnect: invalid source id " + sourceId))
      return
    }
    const targetNode = this._getNode(targetId)
    if (!targetNode) {
      console.error(new Error("disconnect: invalid target id " + targetId))
      return
    }

    const index = this.getLinkIndex(sourceNode.index, targetNode.index)
    if (index === -1) {
      console.error(new Error("disconnect: connection does not exist"))
      return
    }

    this._model.links.splice(index, 1)
    this._update()
  }

  hasPeer(...peers: string[]) {
    return peers.every((nodeId) => {
      return this._getNode(nodeId)
    })
  }

  hasLink(sourceId: ID, targetId: ID) {
    const sourceNode = this._getNode(sourceId)
    if (!sourceNode) return false
    const targetNode = this._getNode(targetId)
    if (!targetNode) return false
    return !!this.getLink(sourceNode.index, targetNode.index)
  }

  areConnected(sourceId: ID, targetId: ID) {
    const sourceNode = this._getNode(sourceId)
    if (!sourceNode) return false
    const targetNode = this._getNode(targetId)
    if (!targetNode) return false
    return this.getLink(sourceNode.index, targetNode.index) || this.getLink(targetNode.index, sourceNode.index)
  }

  unchoke(sourceId: ID, targetId: ID) {
    debug("unchoke %s %s", sourceId, targetId)
    // TODO: resume opacity
  }

  choke(sourceId: ID, targetId: ID) {
    debug("choke %s %s", sourceId, targetId)
    // TODO: lower opacity
  }

  seed(id: ID, isSeeding: boolean) {
    debug(id, "isSeeding:", isSeeding)
    if (typeof isSeeding !== "boolean") throw new Error("seed: 2nd param must be a boolean")
    const index = this._getNodeIndex(id)
    if (index === -1) throw new Error("seed: node does not exist")
    this._model.nodes[index].seeder = isSeeding
    this._update()
  }

  rate(sourceId: ID, targetId: ID, bytesRate: number) {
    debug("rate update:", sourceId + "<->" + targetId, "at", bytesRate)
    if (typeof bytesRate !== "number" || bytesRate < 0) throw new Error("rate: 3th param must be a positive number")
    const sourceNode = this._getNode(sourceId)
    if (!sourceNode) throw new Error("rate: invalid source id")
    const targetNode = this._getNode(targetId)
    if (!targetNode) throw new Error("rate: invalid target id")
    const index = this.getLinkIndex(sourceNode.index, targetNode.index)
    if (index === -1) throw new Error("rate: connection does not exist")
    this._model.links[index].rate = speedRange(bytesRate)
    debug("rate:", this._model.links[index].rate)
    this._update()

    function speedRange(bytes) {
      return (Math.min(bytes, STYLE.links.maxBytes) * STYLE.links.maxWidth) / STYLE.links.maxBytes
    }
  }

  getLink(source: string, target: string) {
    for (let i = 0, len = this._model.links.length; i < len; i += 1) {
      const link = this._model.links[i]
      if (link.source === this._model.nodes[source] && link.target === this._model.nodes[target]) {
        return link
      }
    }
    return null
  }

  destroy() {
    debug("destroy")

    this._root.remove()
    window.removeEventListener("resize", this._resizeThrottled)

    this._root
    this._resizeThrottled = null
  }

  _update() {
    this._link = this._link.data(this._model.links)
    this._node = this._node.data(this._model.nodes, (d) => {
      return d.id
    }) as any

    this._link
      .enter()
      .insert("line", ".node")
      .attr("class", "link")
      .style("stroke", COLORS.links.color)
      .style("opacity", 0.5)

    this._link.exit().remove()

    this._link.style("stroke-width", (d) => {
      // setting thickness
      return d.rate ? (d.rate < STYLE.links.width ? STYLE.links.width : d.rate) : STYLE.links.width
    })

    const g = this._node.enter().append("g").attr("class", "node")

    g.call(this._force.drag)
    const that = this
    g.append("circle")
      .on("mouseover", function (this: HTMLElement, d) {
        d3.select(this).style("fill", COLORS.nodes.hover)

        d3.selectAll(that._childNodes(d))
          .style("fill", COLORS.nodes.hover as any)
          .style("stroke", COLORS.nodes.method as any)
          .style("stroke-width", 2)

        d3.selectAll(that._parentNodes(d))
          .style("fill", COLORS.nodes.dep as any)
          .style("stroke", COLORS.nodes.method as any)
          .style("stroke-width", 2)
      })
      .on("mouseout", function (this: SVGAElement, d) {
        d3.select(this).style("fill", COLORS.nodes.method as any)

        d3.selectAll(that._childNodes(d))
          .style("fill", COLORS.nodes.method as any)
          .style("stroke", null as any)

        d3.selectAll(that._parentNodes(d))
          .style("fill", COLORS.nodes.method as any)
          .style("stroke", null as any)
      })
      .on("click", (d) => {
        if (this._model.focused === d) {
          this._force
            .charge(-200 * this._scale())
            .linkDistance(100 * this._scale())
            .linkStrength(1)
            .start()

          this._node.style("opacity", 1)
          this._link.style("opacity", 0.3)

          this._model.focused = null
          this.events.emit("select", null)
          return
        }

        this._model.focused = d
        this.events.emit("select", d.id)

        this._node.style("opacity", (o) => {
          o.active = this._connected(d, o)
          return o.active ? 1 : 0.2
        })

        this._force
          .charge((o) => {
            return (o.active ? -100 : -1) * this._scale()
          })
          .linkDistance((l) => {
            return (l.source.active && l.target.active ? 100 : 60) * this._scale() * ((l.hops || 1) + 1) * 100
          })
          .linkStrength((l) => {
            return this._scale() * (1 / (l.hops || 1) + 1) // (l.source === d || l.target === d ? 1 : 0) * this._scale()
          })
          .start()

        this._link.style("opacity", function (l, i) {
          return l.source.active && l.target.active ? 1 : 0.02
        })
      })

    this._node
      .select("circle")
      .attr("r", (d) => {
        return this._scale() * (d.me ? 15 : 10)
      })
      .style("fill", COLORS.nodes.method as any)

    g.append("text")
      .attr("class", "text")
      .text((d) => {
        return d.name
      })

    this._node
      .select("text")
      .attr("font-size", (d) => {
        return d.me ? 16 * this._scale() : 12 * this._scale()
      })
      .attr("dx", 0)
      .attr("dy", (d) => {
        return d.me ? -22 * this._scale() : -15 * this._scale()
      })

    this._node.exit().remove()

    this._force
      .linkDistance(100 * this._scale())
      .charge(-200 * this._scale())
      .start()
  }

  _childNodes(d) {
    if (!d.children) return []

    return d.children
      .map((child) => {
        return this._node[0][child]
      })
      .filter(function (child) {
        return child
      })
  }

  _parentNodes(d) {
    if (!d.parents) return []

    return d.parents
      .map((parent) => {
        return this._node[0][parent]
      })
      .filter(function (parent) {
        return parent
      })
  }

  _connected(d, o) {
    return (
      o.id === d.id ||
      (d.children && d.children.indexOf(o.id) !== -1) ||
      (o.children && o.children.indexOf(d.id) !== -1) ||
      (o.parents && o.parents.indexOf(d.id) !== -1) ||
      (d.parents && d.parents.indexOf(o.id) !== -1)
    )
  }

  _getNode(id) {
    for (let i = 0, len = this._model.nodes.length; i < len; i += 1) {
      const node = this._model.nodes[i]
      if (node.id === id) return node
    }
    return null
  }

  _scale() {
    const len = this._model.nodes.length
    return len < 10 ? 1 : Math.max(0.2, 1 - (len - 10) / 100)
  }

  _resize() {
    this._width = this._root.offsetWidth
    this._height = this._root.offsetWidth * 0.8 //window.innerWidth >= 900 ? 400 : 250

    this._svg.attr("width", this._width).attr("height", this._height)

    if (this._force) {
      this._force.size([this._width, this._height]).resume()
    }
  }

  _getNodeIndex(id) {
    for (let i = 0, len = this._model.nodes.length; i < len; i += 1) {
      const node = this._model.nodes[i]
      if (node.id === id) return i
    }
    return -1
  }

  getLinkIndex(source: string, target: string) {
    for (let i = 0, len = this._model.links.length; i < len; i += 1) {
      const link = this._model.links[i]
      if (link.source === this._model.nodes[source] && link.target === this._model.nodes[target]) {
        return i
      }
    }
    return -1
  }
}
