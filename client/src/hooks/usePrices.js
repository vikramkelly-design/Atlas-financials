import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from './useApi'

export default function usePrices(tickers) {
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef(null)

  const fetchPrices = useCallback(async () => {
    if (!tickers || tickers.length === 0) return
    setLoading(true)
    try {
      const res = await api.get(`/api/markets/prices?tickers=${tickers.join(',')}`)
      if (res.data.success) {
        setPrices(res.data.data)
      }
    } catch (err) {
      console.error('Price fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [tickers])

  useEffect(() => {
    fetchPrices()
    intervalRef.current = setInterval(fetchPrices, 60000)
    return () => clearInterval(intervalRef.current)
  }, [fetchPrices])

  return { prices, loading, refetch: fetchPrices }
}
