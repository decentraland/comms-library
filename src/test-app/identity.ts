import { CommsIdentity } from "../lib"
import { RequestManager } from "eth-connect"
import { createUnsafeIdentity } from "@dcl/crypto/dist/crypto"
import { Authenticator } from "@dcl/crypto"

export async function getUserAccount(
  requestManager: RequestManager,
  returnChecksum: boolean = false
): Promise<string | undefined> {
  try {
    const accounts = await requestManager.eth_accounts()

    if (!accounts || accounts.length === 0) {
      return undefined
    }

    return returnChecksum ? accounts[0] : accounts[0].toLowerCase()
  } catch (error: any) {
    throw new Error(`Could not access eth_accounts: "${error.message}"`)
  }
}

export async function createAuthIdentity(
  isGuest: boolean
): Promise<CommsIdentity & { signer: (message: string) => Promise<string> }> {
  let signer: (message: string) => Promise<string>
  let address: string | undefined

  if (!isGuest) {
    const requestManager = new RequestManager((window as any).ethereum)

    address = await getUserAccount(requestManager, false)

    if (!address) throw new Error("Couldn't get an address from the Ethereum provider")
    signer = async (message: string) => {
      while (true) {
        const result = await requestManager.personal_sign(message, address!, "")
        if (!result) continue
        return result
      }
    }
  } else {
    const account = createUnsafeIdentity()
    address = account.address
    signer = async (message: string) => Authenticator.createSignature(account, message)
  }

  const ephemeral = createUnsafeIdentity()
  const auth = await Authenticator.initializeAuthChain(address, ephemeral, 7 * 86400, signer)

  return { ...auth, hasConnectedWeb3: !isGuest, signer }
}
