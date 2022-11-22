import { Authenticator } from "@dcl/crypto"
import { createUnsafeIdentity } from "@dcl/crypto/dist/crypto"
import { useState } from "react"
import { connect, useDispatch, useSelector } from "react-redux"
import { commsConnectToAdapter, commsInitialized, getCommsIdentity, getCommsRoom } from "../lib"
import { backupProfile } from "../lib/adapters/SimulatorAdapter"
import "./App.css"
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

function App() {
  const err = useSelector(getAppError)
  return (
    <div>
      {err ? <pre style={{ color: "red", fontWeight: "bold" }}>{err.toString()}</pre> : <></>}
      <Identity />
      <CommsSelector />
    </div>
  )
}

export default App
