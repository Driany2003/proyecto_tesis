const VOICE_CAPTURE_AUDIO: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
  },
}

const VOICE_CAPTURE_AUDIO_FALLBACK: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
}

export async function getVoiceMediaStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(VOICE_CAPTURE_AUDIO)
  } catch {
    return await navigator.mediaDevices.getUserMedia(VOICE_CAPTURE_AUDIO_FALLBACK)
  }
}
