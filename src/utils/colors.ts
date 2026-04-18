export const getValueColor = (
  val: number,
  type: 'temp' | 'fan' | 'fan_percent' | 'load' | 'voltage_cpu' | 'voltage_gpu' | 'ram'
) => {
  let t = [0, 0, 0]
  switch (type) {
    case 'temp':
      t = [55, 70, 80]
      break
    case 'fan':
      t = [1000, 1200, 1500]
      break
    case 'fan_percent':
      t = [30, 50, 75]
      break
    case 'load':
      t = [15, 50, 80]
      break
    case 'voltage_cpu':
      t = [1.1, 1.2, 1.3]
      break
    case 'voltage_gpu':
      t = [0.9, 0.95, 1.05]
      break
    case 'ram':
      t = [50, 75, 85]
      break
  }
  if (val < t[0]) return 'text-[var(--text-primary)]'
  if (val < t[1]) return 'text-[var(--success)]'
  if (val < t[2]) return 'text-[var(--warning)]'
  return 'text-[var(--danger)]'
}

export const getGlowColor = (val: number, type: 'temp' | 'ram') => {
  let t = [0, 0, 0]
  switch (type) {
    case 'temp':
      t = [55, 70, 80]
      break
    case 'ram':
      t = [50, 75, 90]
      break
  }
  if (val < t[0]) return 'var(--accent)'
  if (val < t[1]) return 'var(--success)'
  if (val < t[2]) return 'var(--warning)'
  return 'var(--danger)'
}
