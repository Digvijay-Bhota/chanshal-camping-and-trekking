import { useState, useEffect, useCallback } from "react"
import toast from "react-hot-toast"
import { Calendar, RefreshCw } from "lucide-react"

// We define minimal Property type to avoid circular dependencies if needed, or import from AdminProperties
interface Property {
  id: number
  name: string
  capacity: number
}

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "")

type DailyAvailability = {
  date: string
  bookedGuests: number
  availableCapacity: number
  available: boolean
}

type AvailabilityResponse = {
  propertyId: number
  capacity: number
  startDate: string
  endDate: string
  days: DailyAvailability[]
}

export default function AdminAvailability() {
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("")

  // Set default dates: today to today + 30 days
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const today = new Date()
  const thirtyDaysLater = new Date(today)
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)

  const [startDate, setStartDate] = useState(getLocalDateString(today))
  const [endDate, setEndDate] = useState(getLocalDateString(thirtyDaysLater))

  const [loading, setLoading] = useState(false)
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)

  // Fetch properties for dropdown
  useEffect(() => {
    fetch(`${API}/api/admin/properties`, { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProperties(data)
          if (data.length > 0) {
            setSelectedPropertyId(String(data[0].id))
          }
        }
      })
      .catch(() => toast.error("Failed to load properties for availability view"))
  }, [])

  const fetchAvailability = useCallback(async () => {
    if (!selectedPropertyId || !startDate || !endDate) return

    setLoading(true)
    try {
      const res = await fetch(
        `${API}/api/admin/properties/${selectedPropertyId}/availability?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
        { credentials: "include" }
      )

      if (res.status === 401 || res.status === 403) {
        toast.error("Unauthorized: Admin access required")
        setAvailability(null)
        return
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch availability")
      }

      setAvailability(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load availability"
      toast.error(msg)
      setAvailability(null)
    } finally {
      setLoading(false)
    }
  }, [selectedPropertyId, startDate, endDate])

  useEffect(() => {
    if (selectedPropertyId) {
      fetchAvailability()
    }
  }, [selectedPropertyId, fetchAvailability])

  return (
    <div className="mt-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-blue-600 dark:text-blue-400" size={24} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Property Availability</h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">
              Select Property
            </label>
            <select
              value={selectedPropertyId}
              onChange={e => setSelectedPropertyId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-blue-500 transition"
            >
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Capacity: {p.capacity ?? 'N/A'})
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-40">
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:[color-scheme:dark] outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="w-full sm:w-40">
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:[color-scheme:dark] outline-none focus:border-blue-500 transition"
            />
          </div>

          <button
            onClick={fetchAvailability}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Check
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <RefreshCw className="animate-spin text-gray-400" size={32} />
          </div>
        ) : availability ? (
          availability.days.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No dates to display.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Date</th>
                    <th className="py-3 px-4 font-semibold">Capacity</th>
                    <th className="py-3 px-4 font-semibold">Booked</th>
                    <th className="py-3 px-4 font-semibold">Available</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {availability.days.map((day, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-200 whitespace-nowrap">
                        {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                      </td>
                      <td className="py-3 px-4">{availability.capacity}</td>
                      <td className="py-3 px-4 font-medium">{day.bookedGuests}</td>
                      <td className="py-3 px-4 font-medium text-green-600 dark:text-green-400">{day.availableCapacity}</td>
                      <td className="py-3 px-4">
                        {day.available ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                            Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                            FULL
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Select a property and date range to view availability.
          </div>
        )}
      </div>
    </div>
  )
}
