// A critically damped glide toward a moving target that starts and ends at rest,
// and carries its speed through a retarget instead of jumping.
export function glide(current, target, velocity, smoothTime, dt) {
  const omega = 2 / smoothTime
  const x = omega * dt
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const change = current - target
  const temp = (velocity + omega * change) * dt
  return { value: target + (change + temp) * decay, velocity: (velocity - omega * temp) * decay }
}
