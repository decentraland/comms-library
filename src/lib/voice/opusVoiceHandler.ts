import * as rfc4 from "@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen"

import "./audioDebugger"
import withCache from "../withCache"
import { createLogger } from "../logger"
import { VoiceHandler } from "../types"
import { VoiceCommunicator } from "./VoiceCommunicator"
import { getSpatialParamsFor } from "./utils"

const getVoiceCommunicator = withCache(() => {
  return new VoiceCommunicator({
    initialListenerParams: undefined,
    panningModel: "HRTF",
  })
})

export const createOpusVoiceHandler = (onDataFrame: (frame: rfc4.Voice) => void): VoiceHandler => {
  const voiceCommunicator = getVoiceCommunicator()

  voiceCommunicator.onDataFrame = onDataFrame

  return {
    setRecording(recording) {
      if (recording) {
        voiceCommunicator.start()
      } else {
        voiceCommunicator.pause()
      }
    },
    onUserTalking(cb) {
      voiceCommunicator.addStreamPlayingListener((streamId: string, playing: boolean) => {
        cb(streamId, playing)
      })
    },
    onRecording(cb) {
      voiceCommunicator.addStreamRecordingListener((recording: boolean) => {
        cb(recording)
      })
    },
    onError(cb) {
      voiceCommunicator.addStreamRecordingErrorListener((message) => {
        cb(message)
      })
    },
    reportPosition(position: rfc4.Position) {
      voiceCommunicator.setListenerSpatialParams(getSpatialParamsFor(position))
    },
    setVolume: function (volume) {
      voiceCommunicator.setVolume(volume)
    },
    setMute: (mute) => {
      voiceCommunicator.setMute(mute)
    },
    setInputStream: (stream) => {
      return voiceCommunicator.setInputStream(stream)
    },
    hasInput: () => {
      return voiceCommunicator.hasInput()
    },
    playEncodedAudio: (src, position, encoded) => {
      return voiceCommunicator.playEncodedAudio(src, getSpatialParamsFor(position), encoded)
    },
    async destroy() {
      // noop
    },
  }
}
