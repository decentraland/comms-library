import { Authenticator } from "@dcl/crypto"
import { createUnsafeIdentity } from "@dcl/crypto/dist/crypto"
import { useEffect, useState } from "react"
import { connect, useDispatch, useSelector } from "react-redux"
import { topologyEvents } from "../debug-helpers/p2p"
import { commsConnectToAdapter, commsInitialized, getCommsIdentity, getCommsRoom } from "../lib"
import { backupProfile } from "../lib/adapters/SimulatorAdapter"
import { TopologyParams } from "../lib/interface"
import "./App.css"
import { Dot, PositionalCanvas } from "./Graph"
import { createAuthIdentity } from "./identity"
import { lastPosition } from "./kernel/globals"
import { getAppError } from "./kernel/selectors"

function Identity() {
  const currentIdentity = useSelector(getCommsIdentity)
  const dispatch = useDispatch()
  const [identity, setIdentity] = useState(createUnsafeIdentity())

  async function guestLogin() {
    const avatar = backupProfile(identity.address)
    const baseUrl = "https://peer.decentraland.org/content/contents/"

    const auth = await createAuthIdentity(true)

    dispatch(commsInitialized(auth, () => lastPosition, baseUrl, avatar))
  }

  async function walletLogin() {
    const avatar = backupProfile(identity.address)
    const baseUrl = "https://peer.decentraland.org/content/contents/"

    const auth = await createAuthIdentity(true)

    dispatch(commsInitialized(auth, () => lastPosition, baseUrl, avatar))
  }

  return (
    <>
      <fieldset>
        <legend>Identity {currentIdentity ? currentIdentity.authChain[0].payload : "NOT SET"}</legend>
        <details open={!currentIdentity}>
          <summary>Controls</summary>
          <button onClick={guestLogin}>Guest login</button>
          <button onClick={walletLogin}>Ethereum login</button>
        </details>
      </fieldset>
    </>
  )
}

function CommsSelector(props) {
  const currentIdentity = useSelector(getCommsIdentity)
  const room = useSelector(getCommsRoom)
  const [url, setUrl] = useState(
    localStorage.getItem("last-url") || "ws-room:ws-room-service.decentraland.org/rooms/debugger"
  )
  const [island, setIsland] = useState<string>("")
  const dispatch = useDispatch()

  function connect() {
    localStorage.setItem("last-url", url)
    dispatch(
      commsConnectToAdapter({
        connStr: url,
        islandId: island || "",
        peers: {},
      })
    )
  }

  return (
    <fieldset>
      <legend>{room ? "Connected! ✅" : "Connect to room"}</legend>
      {currentIdentity ? (
        <>
          <div className="field-row">
            <label>Connection string</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="field-row">
            <label>Island</label>
            <input value={island} onChange={(e) => setIsland(e.target.value)} />
          </div>
          <button onClick={connect}>Connect</button>
        </>
      ) : (
        <span>First connect the wallet</span>
      )}
    </fieldset>
  )
}

function nodeId(x: string) {
  return JSON.stringify(x)
}
function addr(x: string) {
  return JSON.stringify(x.substring(0, 8) + "..." + x.substr(-6))
}

function Topology() {
  const [graph, setGraph] = useState(null)
  const [dot, setDot] = useState("")

  function listener(topology: Map<string, Map<string, TopologyParams>>) {
    const nodes: string[] = []
    const edges: string[] = []

    const rings = new Map<string, Set<string>>()

    const smallerHops = new Map<string, number>()

    function setNodeWithHops(address: string, hops: number) {
      if (!smallerHops.has(address)) {
        smallerHops.set(address, hops)
      } else {
        if (smallerHops.get(address)! > hops) {
          smallerHops.set(address, hops)
        }
      }
    }

    for (const [source, targets] of topology) {
      for (const [target, params] of targets) {
        setNodeWithHops(target, params.hops || 0)
      }
    }

    function setInRing(ring: string, nodeId: string) {
      if (!rings.has(ring)) {
        rings.set(ring, new Set())
      }
      rings.get(ring)!.add(nodeId)
    }

    function ring(str: number | undefined) {
      return "cluster_" + str
    }

    for (const [target, hops] of smallerHops) {
      setInRing(ring(hops), nodeId(target))
    }

    for (const [ring, ids] of rings) {
      nodes.push(`subgraph ${ring} {\n`)
      nodes.push(`label = "${ring}";`)
      nodes.push(
        Array.from(ids)
          .map(($) => $ + ";")
          .join("\n")
      )
      nodes.push(`}\n`)
    }

    for (const [source, targets] of topology) {
      nodes.push(`${nodeId(source)} [label=${addr(source)}];`)
      for (const [target, params] of targets) {
        nodes.push(`${nodeId(target)} [label=${addr(target)}];`)
        edges.push(`${nodeId(source)}->${nodeId(target)};`)
      }
    }

    //
    // layout=sfdp;
    setDot(`digraph G {
      graph [ranksep=3, fontname = "arial", fontsize="10", color="grey", fontcolor="grey",rankdir=LR,concentrate=true, splines=ortho,overlap=prism];
      node [fontname = "arial",fontsize="10", shape="box", style="rounded"];
      edge [fontname = "arial",color="blue", fontcolor="blue",fontsize="10"];
# nodes
${nodes.join("\n")}
# edges
${edges.join("\n")}
}`)
  }

  ;(globalThis as any).__DEBUG_DOT = dot

  useEffect(() => {
    topologyEvents.on("changed", listener)
    return () => {
      topologyEvents.off("changed", listener)
    }
  }, [])

  return (
    <>
      <fieldset>
        <legend>Topology</legend>
        <Dot code={dot} />
      </fieldset>
      <fieldset>
        <legend>Audio</legend>
        <PositionalCanvas />
      </fieldset>
    </>
  )
}

function App() {
  const err = useSelector(getAppError)
  return (
    <div>
      {err ? <pre style={{ color: "red", fontWeight: "bold" }}>{err.toString()}</pre> : <></>}
      <Identity />
      <CommsSelector />
      <Topology />
    </div>
  )
}

export default App
