import { useState, useEffect } from 'react'

export default function TypewriterText({
  text,
  speed = 35,
  startDelay = 0,
  onComplete,
  className = '',
  style = {},
  cursor = true,
}) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(text)
      setDone(true)
      setStarted(true)
      onComplete?.()
      return
    }

    const timeout = setTimeout(() => {
      setStarted(true)
      let i = 0
      const interval = setInterval(() => {
        i++
        setDisplayed(text.slice(0, i))
        if (i >= text.length) {
          clearInterval(interval)
          setDone(true)
          onComplete?.()
        }
      }, speed)
      return () => clearInterval(interval)
    }, startDelay)
    return () => clearTimeout(timeout)
  }, [text, speed, startDelay])

  if (!started) return <span className={className} style={{ ...style, visibility: 'hidden' }}>{text}</span>

  return (
    <span className={className} style={style}>
      {displayed}
      {cursor && !done && (
        <span className="typewriter-cursor">|</span>
      )}
    </span>
  )
}
