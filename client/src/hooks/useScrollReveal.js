import { useEffect, useRef } from 'react'

export default function useScrollReveal(options = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('scroll-visible')
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add('scroll-visible')
        observer.unobserve(el)
      }
    }, {
      threshold: options.threshold ?? 0.15,
      rootMargin: options.rootMargin ?? '0px 0px -60px 0px',
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}
