import { ILogger } from "@dcl/rpc"

function createDefaultLogger(subPrefix: string = ""): ILogger {
  return {
    error(message: string | Error, ...args: any[]): void {
      if (typeof message === "object" && message.stack) {
        console.error(subPrefix, message, ...args, message.stack)
      } else {
        console.error(subPrefix, message, ...args)
      }
    },
    log(message: string, ...args: any[]): void {
      if (args && args[0] && args[0].startsWith && args[0].startsWith("The entity is already in the engine.")) {
        return
      }
      console.log(subPrefix, message, ...args)
    },
    warn(message: string, ...args: any[]): void {
      console.log(subPrefix, message, ...args)
    },
    info(message: string, ...args: any[]): void {
      console.info(subPrefix, message, ...args)
    },
    debug(message: string, ...args: any[]): void {
      console.trace(subPrefix, message, ...args)
    },
  }
}

export function createLogger(prefix: string): ILogger {
  return createDefaultLogger(prefix)
}
