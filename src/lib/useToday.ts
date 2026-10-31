import { useEffect, useState } from 'react'
import { todayISODate } from './format'

/** Today's date (YYYY-MM-DD), re-checked each minute so screens roll over at midnight. */
export function useTodayISO(): string {
  const [today, setToday] = useState(todayISODate)
  useEffect(() => {
    const id = setInterval(() => setToday(todayISODate()), 60_000)
    return () => clearInterval(id)
  }, [])
  return today
}
