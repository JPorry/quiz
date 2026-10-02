export function renderProfile(width, pixelRatio = 1, coarsePointer = false) {
  const mobile = width < 700 || coarsePointer
  return {
    maxFps: mobile ? 30 : 45,
    pixelRatio: Math.min(pixelRatio, mobile ? 1.25 : 1.5),
    shadowSize: mobile ? 1024 : 2048,
    shadowInterval: mobile ? 200 : 100,
  }
}

export function frameIsDue(time, lastFrame, maxFps, hidden = false) {
  return !hidden && time - lastFrame >= 1000 / maxFps - 0.5
}

export function scheduledFrameTime(time, lastFrame, maxFps) {
  if (!Number.isFinite(lastFrame)) return time
  const interval = 1000 / maxFps
  return lastFrame + Math.max(1, Math.floor((time - lastFrame + 0.5) / interval)) * interval
}
