/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Track,
  ParticipantEvent,
  RemoteAudioTrack,
  LocalAudioTrack,
} from "livekit-client"
import { startLoopback } from "./loopback"

import * as rfc4 from "@dcl/protocol/out-ts/decentraland/kernel/comms/rfc4/comms.gen"
import { VoiceHandler } from "../types"
import { createLogger } from "../logger"
import { isChrome, setListenerParams, setPanNodeParams } from "./utils"

type ParticipantInfo = {
  participant: RemoteParticipant
  tracks: Map<string, ParticipantTrack>
}

type ParticipantTrack = {
  track: LocalAudioTrack | RemoteAudioTrack
  streamNode: MediaStreamAudioSourceNode
  panNode: PannerNode
}

export const createLiveKitVoiceHandler = async (room: Room): Promise<VoiceHandler> => {
  const logger = createLogger("🎙 LiveKitVoiceCommunicator: ")

  let recordingListener: ((state: boolean) => void) | undefined
  let errorListener: ((message: string) => void) | undefined
  let globalVolume: number = 1.0
  let globalMuted: boolean = false
  let validInput = false
  let onUserTalkingCallback: (userId: string, talking: boolean) => void = () => {}

  const participantsInfo = new Map<string, ParticipantInfo>()
  const audioContext = new AudioContext()
  const destination = audioContext.createMediaStreamDestination()
  const destinationStream = isChrome() ? await startLoopback(destination.stream) : destination.stream

  const gainNode = audioContext.createGain()
  gainNode.connect(destination)
  gainNode.gain.value = 1

  const loopbackElement = new Audio()
  loopbackElement.autoplay = true
  document.body.appendChild(loopbackElement)
  loopbackElement.srcObject = destinationStream

  function getGlobalVolume(): number {
    return globalMuted ? 0.0 : globalVolume
  }

  function getParticipantInfo(participant: RemoteParticipant): ParticipantInfo {
    const addr = participant.identity.toLowerCase()

    let $: ParticipantInfo | undefined = participantsInfo.get(addr)

    if (!$) {
      $ = {
        participant,
        tracks: new Map(),
      }
      participantsInfo.set(addr, $)

      participant.on(ParticipantEvent.IsSpeakingChanged, (talking: boolean) => {
        onUserTalkingCallback(addr, talking)
      })

      logger.info("Adding participant", addr as any)
    }

    return $
  }

  // this function sets up the local tracking of the remote participant
  // and refreshes the audio nodes based on the most up-to-date audio tracks
  function setupTracksForParticipant(participant: RemoteParticipant) {
    const info = getParticipantInfo(participant)

    // first remove extra tracks
    for (const [trackId, track] of info.tracks) {
      if (!participant.audioTracks.has(trackId)) {
        disconnectParticipantTrack(track)
        info.tracks.delete(trackId)
      }
    }

    // and subscribe to new ones
    for (const [, track] of participant.audioTracks) {
      if (track.audioTrack?.kind === Track.Kind.Audio) {
        subscribeParticipantTrack(participant, track.audioTrack as any)
      }
    }
  }

  function subscribeParticipantTrack(participant: RemoteParticipant, track: RemoteAudioTrack) {
    const info = getParticipantInfo(participant)
    const trackId = track.sid
    if (trackId && !info.tracks.has(trackId) && track.kind === Track.Kind.Audio && track.mediaStream) {
      info.tracks.set(trackId, setupAudioTrackForRemoteTrack(track))
    }
  }

  function setupAudioTrackForRemoteTrack(track: RemoteAudioTrack): ParticipantTrack {
    logger.info("Adding media track", track.sid as any)
    const streamNode = audioContext.createMediaStreamSource(track.mediaStream!)
    const panNode = audioContext.createPanner()

    streamNode.connect(panNode)
    panNode.connect(gainNode)

    panNode.panningModel = "equalpower"
    panNode.distanceModel = "inverse"
    panNode.refDistance = 5
    panNode.maxDistance = 10000
    panNode.coneOuterAngle = 360
    panNode.coneInnerAngle = 180
    panNode.coneOuterGain = 0.9
    panNode.rolloffFactor = 1.0

    return {
      panNode,
      streamNode,
      track,
    }
  }

  function disconnectParticipantTrack(participantTrack: ParticipantTrack) {
    logger.info("Disconnecting media track", participantTrack.track.sid as any)
    participantTrack.panNode.disconnect()
    participantTrack.streamNode.disconnect()
    participantTrack.track.stop()
    participantTrack.track.detach()
  }

  function handleTrackSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    if (track.kind === Track.Kind.Audio) {
      subscribeParticipantTrack(participant, track as RemoteAudioTrack)
    }
  }
  function handleTrackUnsubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    setupTracksForParticipant(participant)
  }

  async function handleDisconnect() {
    logger.log("HANDLER DISCONNECTED")

    room
      .off(RoomEvent.Disconnected, handleDisconnect)
      .off(RoomEvent.TrackSubscribed, handleTrackSubscribed)
      .off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
      .off(RoomEvent.TrackPublished, handleTrackPublished)
      .off(RoomEvent.TrackUnpublished, handleTrackUnpublished)
      .off(RoomEvent.MediaDevicesError, handleMediaDevicesError)
      .off(RoomEvent.ParticipantConnected, addParticipant)
      .off(RoomEvent.ParticipantDisconnected, removeParticipant)

    for (const [userId] of participantsInfo) {
      removeParticipantById(userId)
    }
    participantsInfo.clear()

    gainNode.disconnect()
    try {
      await audioContext.close()
    } catch (err) {}
  }

  function handleMediaDevicesError() {
    if (errorListener) errorListener("Media Device Error")
  }

  function addParticipant(participant: RemoteParticipant) {
    setupTracksForParticipant(participant)
  }

  function removeParticipantById(userId: string) {
    const addr = userId.toLowerCase()
    // remove tracks from all attached elements
    const participantInfo = participantsInfo.get(addr)
    if (participantInfo) {
      logger.info("Removing participant", addr as any)
      for (const [trackId, participantTrack] of participantInfo.tracks) {
        try {
          disconnectParticipantTrack(participantTrack)
          participantInfo.tracks.delete(trackId)
        } catch (err: any) {
          logger.error(err)
        }
      }
      participantsInfo.delete(addr)
    }
  }

  function removeParticipant(participant: RemoteParticipant) {
    removeParticipantById(participant.identity)
  }

  function handleTrackPublished(trackPublication: RemoteTrackPublication, remoteParticipant: RemoteParticipant) {
    if (trackPublication.audioTrack) {
      subscribeParticipantTrack(remoteParticipant, trackPublication.audioTrack as RemoteAudioTrack)
    }
  }

  function handleTrackUnpublished(trackPublication: RemoteTrackPublication, remoteParticipant: RemoteParticipant) {
    setupTracksForParticipant(remoteParticipant)
  }

  function reconnectAllParticipants() {
    // remove all participants
    for (const [identity] of participantsInfo) {
      removeParticipantById(identity)
    }

    // add existing participants
    for (const [_, participant] of room.participants) {
      addParticipant(participant)
    }
  }

  function updateParticipantsVolume() {
    gainNode.gain.value = getGlobalVolume()
  }

  room
    .on(RoomEvent.Disconnected, handleDisconnect)
    .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
    .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
    .on(RoomEvent.MediaDevicesError, handleMediaDevicesError)
    .on(RoomEvent.ParticipantConnected, addParticipant)
    .on(RoomEvent.ParticipantDisconnected, removeParticipant)
    .on(RoomEvent.RoomMetadataChanged, function (...args) {
      logger.log("RoomMetadataChanged", args as any)
    })
    .on(RoomEvent.Reconnected, function (...args) {
      reconnectAllParticipants()
    })
    .on(RoomEvent.MediaDevicesChanged, function (...args) {
      logger.log("MediaDevicesChanged", args as any)
    })
    .on(RoomEvent.ParticipantMetadataChanged, function (...args) {
      logger.log("ParticipantMetadataChanged", args as any)
    })

  if (audioContext.state !== "running") await audioContext.resume()

  logger.log("initialized")

  reconnectAllParticipants()

  return {
    setRecording(recording) {
      room.localParticipant
        .setMicrophoneEnabled(recording)
        .then(() => {
          if (recordingListener) recordingListener(recording)
        })
        .catch((err) => logger.error("Error: ", err))
    },
    onUserTalking(cb) {
      onUserTalkingCallback = cb
      try {
        if (!room.canPlaybackAudio) {
          room.startAudio().catch(logger.error)
        }

        loopbackElement?.play().catch(logger.log)
      } catch (err: any) {
        logger.error(err)
      }
    },
    onRecording(cb) {
      recordingListener = cb
    },
    onError(cb) {
      errorListener = cb
    },
    reportPeerPosition(address: string, position: rfc4.Position) {
      const addr = address.toLowerCase()
      const participant = participantsInfo.get(addr)
      if (participant) {
        for (const [, { panNode }] of participant.tracks) {
          setPanNodeParams(audioContext, panNode, position)
        }
      }
    },
    reportPosition(position: rfc4.Position) {
      setListenerParams(audioContext, audioContext.listener, position)
    },
    setVolume: function (volume) {
      globalVolume = volume
      updateParticipantsVolume()
    },
    setMute: (mute) => {
      globalMuted = mute
      updateParticipantsVolume()
    },
    setInputStream: async (localStream) => {
      try {
        await room.switchActiveDevice("audioinput", localStream.id)
        validInput = true
      } catch (e) {
        validInput = false
        if (errorListener) errorListener("setInputStream catch" + JSON.stringify(e))
      }
    },
    hasInput: () => {
      return validInput
    },
    async destroy() {
      room.localParticipant.unpublishTracks(
        Array.from(room.localParticipant.audioTracks.values())
          .map(($) => $.audioTrack!)
          .filter(Boolean)
      )
      await handleDisconnect()
    },
  }
}
