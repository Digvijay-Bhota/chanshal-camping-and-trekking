import { useEffect, useState, useCallback } from "react"
import toast from "react-hot-toast"
import { CheckCircle, XCircle, Clock, ShieldCheck, RefreshCw } from "lucide-react"
import AdminAvailability from "../components/AdminAvailability"

export interface AdminBooking {
  id: number
  userId: number
  propertyId: number
  checkIn: string
  checkOut: string
  guests: number
  totalAmount: number
  status: string
  paymentStatus?: string
  createdAt?: string
  updatedAt?: string
  user: {
    id: number
    name: string
    email: string | null
    phone: string | null
  }
  camp: {
    id: number
    name: string
    location: string
    price: number
    rating: number
    image: string | null
  }
}

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "")

function AdminDashboard() {
  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>("all")
  const [filterPropertyId, setFilterPropertyId] = useState<string>("")
  const [filterStartDate, setFilterStartDate] = useState<string>("")
  const [filterEndDate, setFilterEndDate] = useState<string>("")

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus !== "all") params.append("status", filterStatus)
      if (filterPaymentStatus !== "all") params.append("paymentStatus", filterPaymentStatus)
      if (filterPropertyId) params.append("propertyId", filterPropertyId)
      if (filterStartDate) params.append("startDate", filterStartDate)
      if (filterEndDate) params.append("endDate", filterEndDate)

      const res = await fetch(`${API}/api/admin/bookings?${params.toString()}`, {
        credentials: "include",
      })

      if (res.status === 401 || res.status === 403) {
        toast.error("Unauthorized: Admin access required")
        setBookings([])
        return
      }

      if (!res.ok) {
        throw new Error("Failed to fetch bookings")
      }

      const data: AdminBooking[] = await res.json()
      setBookings(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load admin bookings"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterPaymentStatus, filterPropertyId, filterStartDate, filterEndDate])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const handleUpdateStatus = async (
    bookingId: number,
    targetStatus: "confirmed" | "completed" | "cancelled"
  ) => {
    setUpdatingId(bookingId)

    try {
      const res = await fetch(`${API}/api/admin/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: targetStatus }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.status === 200) {
        toast.success(data.message || `Booking status updated to ${targetStatus}`)
        await fetchBookings()
      } else if (res.status === 409) {
        toast.error(data.message || "Booking status changed by another request")
        await fetchBookings()
      } else if (res.status === 401 || res.status === 403) {
        toast.error("Access denied: Unauthorized or non-admin user")
      } else {
        toast.error(data.message || "Failed to update status")
      }
    } catch {
      toast.error("Network error updating status")
    } finally {
      setUpdatingId(null)
    }
  }

  const [detailsBookingId, setDetailsBookingId] = useState<number | null>(null)
  const [detailsData, setDetailsData] = useState<any>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const handleViewDetails = async (id: number) => {
    setDetailsBookingId(id)
    setDetailsLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/bookings/${id}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch details")
      setDetailsData(await res.json())
    } catch {
      toast.error("Error loading booking details")
      setDetailsBookingId(null)
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleCancelBooking = async (id: number) => {
    if (!confirm("Are you sure you want to cancel this booking? This action may process a refund.")) return

    setUpdatingId(id)
    try {
      const res = await fetch(`${API}/api/admin/bookings/${id}/cancel`, {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Failed to cancel booking")
      }

      toast.success(data.message || "Booking cancelled successfully")
      setBookings(prev =>
        prev.map(b => (b.id === id ? { ...b, status: "cancelled", paymentStatus: b.paymentStatus === "paid" ? "refunded" : b.paymentStatus } : b))
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error cancelling booking")
    } finally {
      setUpdatingId(null)
    }
  }

  // Summary counts based on fetched data
  const totalCount = bookings.length
  const pendingCount = bookings.filter(b => b.status === "pending").length
  const confirmedCount = bookings.filter(b => b.status === "confirmed").length
  const completedCount = bookings.filter(b => b.status === "completed").length
  const cancelledCount = bookings.filter(b => b.status === "cancelled").length

  const filteredBookings = bookings

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <Clock size={12} /> Pending
          </span>
        )

      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
            <ShieldCheck size={12} /> Confirmed
          </span>
        )

      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            <CheckCircle size={12} /> Completed
          </span>
        )

      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
            <XCircle size={12} /> Cancelled
          </span>
        )

      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              🛡️ Admin Booking Dashboard
            </h1>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage platform bookings, view customer details, and update booking status.
            </p>
          </div>

          <button
            onClick={fetchBookings}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* SUMMARY STATS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {totalCount}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 shadow-sm">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Pending
            </p>

            <p className="mt-2 text-2xl font-bold text-amber-800 dark:text-amber-300">
              {pendingCount}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 shadow-sm">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              Confirmed
            </p>

            <p className="mt-2 text-2xl font-bold text-blue-800 dark:text-blue-300">
              {confirmedCount}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 shadow-sm">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Completed
            </p>

            <p className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-300">
              {completedCount}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 shadow-sm col-span-2 sm:col-span-1">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-400 uppercase tracking-wider">
              Cancelled
            </p>

            <p className="mt-2 text-2xl font-bold text-rose-800 dark:text-rose-300">
              {cancelledCount}
            </p>
          </div>
        </div>

        {/* FILTER TABS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-gray-200 dark:border-gray-800">
          {[
            { id: "all", label: `All (${totalCount})` },
            { id: "pending", label: `Pending (${pendingCount})` },
            { id: "confirmed", label: `Confirmed (${confirmedCount})` },
            { id: "completed", label: `Completed (${completedCount})` },
            { id: "cancelled", label: `Cancelled (${cancelledCount})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === tab.id
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ADVANCED FILTERS */}
        <div className="flex flex-wrap gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Payment Status</label>
            <select
              value={filterPaymentStatus}
              onChange={e => setFilterPaymentStatus(e.target.value)}
              className="text-sm p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Property ID</label>
            <input
              type="number"
              min="1"
              value={filterPropertyId}
              onChange={e => setFilterPropertyId(e.target.value)}
              placeholder="e.g. 1"
              className="w-24 text-sm p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
              className="text-sm p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End Date</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={e => setFilterEndDate(e.target.value)}
              className="text-sm p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
            />
          </div>
        </div>

        {/* BOOKINGS TABLE CONTAINER */}
        {loading ? (
          <div className="py-20 text-center text-gray-500 dark:text-gray-400 font-medium">
            Loading admin bookings...
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No bookings found matching filter.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="py-3.5 px-4">ID</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Camp</th>
                    <th className="py-3.5 px-4">Dates</th>
                    <th className="py-3.5 px-4">Guests</th>
                    <th className="py-3.5 px-4">Total</th>
                    <th className="py-3.5 px-4">Reservation</th>
                    <th className="py-3.5 px-4">Payment</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-gray-700/60">
                  {filteredBookings.map(b => {
                    const isUpdating = updatingId === b.id

                    return (
                      <tr
                        key={b.id}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-750 transition-colors"
                      >
                        {/* BOOKING ID */}
                        <td className="py-4 px-4 font-mono font-medium text-gray-900 dark:text-white">
                          #{b.id}
                        </td>

                        {/* CUSTOMER INFO */}
                        <td className="py-4 px-4">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {b.user.name}
                          </div>

                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {b.user.email || "No email"}
                          </div>

                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {b.user.phone || "No phone"}
                          </div>
                        </td>

                        {/* CAMP INFO */}
                        <td className="py-4 px-4">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {b.camp.name}
                          </div>

                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            📍 {b.camp.location}
                          </div>
                        </td>

                        {/* DATES */}
                        <td className="py-4 px-4 text-xs whitespace-nowrap">
                          <div className="text-gray-900 dark:text-white font-medium">
                            {b.checkIn}
                          </div>

                          <div className="text-gray-500 dark:text-gray-400">
                            to {b.checkOut}
                          </div>
                        </td>

                        {/* GUESTS */}
                        <td className="py-4 px-4 text-gray-900 dark:text-white">
                          {b.guests}
                        </td>

                        {/* TOTAL AMOUNT */}
                        <td className="py-4 px-4 font-semibold text-gray-900 dark:text-white">
                          ₹{b.totalAmount}
                        </td>

                        {/* RESERVATION STATUS */}
                        <td className="py-4 px-4">
                          {getStatusBadge(b.status)}
                        </td>

                        {/* PAYMENT STATUS */}
                        <td className="py-4 px-4">
                          {b.paymentStatus === "paid" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle size={12} /> Paid ✅
                            </span>
                          ) : b.paymentStatus === "refunded" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              <RefreshCw size={12} /> Refunded ↩️
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <Clock size={12} /> Unpaid ⏳
                            </span>
                          )}
                        </td>

                        {/* ACTIONS */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewDetails(b.id)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 transition"
                            >
                              View
                            </button>

                            {b.status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(b.id, "confirmed")}
                                  disabled={isUpdating}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition shadow-sm"
                                >
                                  {isUpdating ? "Updating..." : "Confirm"}
                                </button>
                                <button
                                  onClick={() => handleCancelBooking(b.id)}
                                  disabled={isUpdating}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-md text-rose-700 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900/60 disabled:opacity-50 transition"
                                >
                                  Cancel
                                </button>
                              </>
                            )}

                            {b.status === "confirmed" && (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(b.id, "completed")}
                                  disabled={isUpdating}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
                                >
                                  {isUpdating ? "Updating..." : "Complete"}
                                </button>
                                <button
                                  onClick={() => handleCancelBooking(b.id)}
                                  disabled={isUpdating}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-md text-rose-700 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900/60 disabled:opacity-50 transition"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <AdminAvailability />
      </div>

      {/* DETAILS MODAL */}
      {detailsBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold dark:text-white">Booking #{detailsBookingId}</h2>
              <button onClick={() => setDetailsBookingId(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <XCircle size={24} className="text-gray-500" />
              </button>
            </div>

            {detailsLoading ? (
              <p className="text-center py-8 text-gray-500">Loading details...</p>
            ) : detailsData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Customer Info</h3>
                    <p className="dark:text-white font-medium">{detailsData.user?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{detailsData.user?.email || "No email"}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{detailsData.user?.phone || "No phone"}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Property Info</h3>
                    <p className="dark:text-white font-medium">{detailsData.camp?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">📍 {detailsData.camp?.location}</p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">Booking Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Check In:</span>
                      <p className="dark:text-white font-medium">{detailsData.checkIn}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Check Out:</span>
                      <p className="dark:text-white font-medium">{detailsData.checkOut}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Guests:</span>
                      <p className="dark:text-white font-medium">{detailsData.guests}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Amount:</span>
                      <p className="dark:text-white font-medium">₹{detailsData.totalAmount}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <div className="mt-1">{getStatusBadge(detailsData.status)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Payment:</span>
                      <p className="dark:text-white font-medium uppercase">{detailsData.paymentStatus}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-rose-500">Failed to load booking details.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
