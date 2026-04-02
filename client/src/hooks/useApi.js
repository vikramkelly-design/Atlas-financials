import { useState, useCallback } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const api = axios.create({ baseURL: API })

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('atlas_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 — redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('atlas_token')
      localStorage.removeItem('atlas_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const request = useCallback(async (method, url, data = null) => {
    setLoading(true)
    setError(null)
    try {
      const config = { method, url }
      if (data && (method === 'post' || method === 'patch' || method === 'put')) {
        config.data = data
      }
      const res = await api(config)
      return res.data
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const get = useCallback((url) => request('get', url), [request])
  const post = useCallback((url, data) => request('post', url, data), [request])
  const patch = useCallback((url, data) => request('patch', url, data), [request])
  const del = useCallback((url) => request('delete', url), [request])

  return { loading, error, get, post, patch, del, setError }
}
