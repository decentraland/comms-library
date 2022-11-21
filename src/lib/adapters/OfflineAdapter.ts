import mitt from 'mitt'
import { VoiceHandler } from '../types'
import { createOpusVoiceHandler } from '../voice/opusVoiceHandler'
import { CommsAdapterEvents, MinimumCommunicationsAdapter, SendHints } from './types'

export class OfflineAdapter implements MinimumCommunicationsAdapter {
  events = mitt<CommsAdapterEvents>()

  constructor() {}
  async getVoiceHandler(onDataFrame): Promise<VoiceHandler> {
    return createOpusVoiceHandler(onDataFrame)
  }
  async disconnect(_error?: Error | undefined): Promise<void> {}
  send(_data: Uint8Array, _hints: SendHints): void {}
  async connect(): Promise<void> {}
}
