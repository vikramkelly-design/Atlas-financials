export function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function formatMarketCap(n) {
  if (!n) return '--'
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  return n.toLocaleString()
}

export function formatPercent(n) {
  if (n === null || n === undefined) return '--'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

export function numColor(n) {
  if (n > 0) return 'var(--color-success)'
  if (n < 0) return 'var(--color-danger)'
  return 'var(--color-text)'
}

export default function NumberDisplay({ value, format = 'currency', size = '1rem', style = {} }) {
  let display
  let color = 'var(--color-text)'

  if (format === 'currency') {
    display = formatCurrency(value)
    color = numColor(value)
  } else if (format === 'percent') {
    display = formatPercent(value)
    color = numColor(value)
  } else if (format === 'marketcap') {
    display = formatMarketCap(value)
  } else {
    display = value?.toLocaleString?.() ?? value
  }

  return (
    <span className="mono" style={{ fontSize: size, color, ...style }}>
      {display}
    </span>
  )
}
