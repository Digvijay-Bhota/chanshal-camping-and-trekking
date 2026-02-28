import { useParams, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { motion } from "framer-motion"

const API =
  import.meta.env.VITE_API_URL || "http://localhost:4000"

type Camp = {
  id: number
  name: string
  price: number
  location: string
  rating: number
  image: string
}

/* 🎬 CONTENT REVEAL ANIMATION */
const contentVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.25, duration: 0.4 },
  },
}

function Booking() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [camp, setCamp] = useState<Camp | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: localStorage.getItem("user") || "",
    phone: "",
    date: "",
    people: 1,
    days: 1,
  })

  useEffect(() => {
    if (!id) return

    fetch(`${API}/api/camps/${id}`)
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(data => setCamp(data))
      .catch(() => toast.error("Failed to load camp"))
      .finally(() => setLoading(false))
  }, [id])

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-xl animate-pulse">
        ⛺ Loading Camp...
      </div>
    )

  if (!camp)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Camp not found ❌
      </div>
    )

  const total =
    camp.price *
    Number(form.people || 1) *
    Number(form.days || 1)

  const today = new Date().toISOString().split("T")[0]

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.date) {
      toast.error("Please fill all fields")
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch(`${API}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          campId: id,
          total,
        }),
      })

      if (!res.ok) throw new Error()

      toast.success("Booking successful 🎉")
      navigate("/my-bookings")
    } catch {
      toast.error("Booking failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 p-6 bg-white text-black dark:bg-gray-900 dark:text-white">

      {/* 🔙 BACK */}
      <button
        onClick={() => navigate(-1)}
        className="mb-6 bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded"
      >
        ⬅ Back
      </button>

      <motion.div
        layout
        className="max-w-3xl mx-auto bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg"
      >

        {/* 🖼 IMAGE */}
        <motion.img
          layoutId={`camp-image-${camp.id}`}
          src={camp.image}
          alt={camp.name}
          className="w-full h-64 object-cover"
        />

        {/* 🎬 CONTENT */}
        <motion.div
          variants={contentVariants}
          initial="hidden"
          animate="show"
          className="p-6"
        >

          <h1 className="text-3xl font-bold">{camp.name}</h1>
          <p className="mt-2">📍 {camp.location}</p>
          <p>⭐ {camp.rating}</p>

          <p className="text-green-500 text-xl font-bold">
            ₹{camp.price}
          </p>

          {/* 📝 FORM */}
          <div className="mt-6 space-y-4 pb-28">

            <input
              placeholder="Your Name"
              value={form.name}
              onChange={e =>
                setForm({ ...form, name: e.target.value })
              }
              className="w-full p-3 rounded bg-white dark:bg-gray-700"
            />

            <input
              placeholder="Phone Number"
              value={form.phone}
              onChange={e =>
                setForm({ ...form, phone: e.target.value })
              }
              className="w-full p-3 rounded bg-white dark:bg-gray-700"
            />

            <input
              type="date"
              min={today}
              value={form.date}
              onChange={e =>
                setForm({ ...form, date: e.target.value })
              }
              className="w-full p-3 rounded bg-white dark:bg-gray-700"
            />

            <input
              type="number"
              min="1"
              value={form.people}
              onChange={e =>
                setForm({
                  ...form,
                  people: Number(e.target.value),
                })
              }
              className="w-full p-3 rounded bg-white dark:bg-gray-700"
            />

            <input
              type="number"
              min="1"
              value={form.days}
              onChange={e =>
                setForm({
                  ...form,
                  days: Number(e.target.value),
                })
              }
              className="w-full p-3 rounded bg-white dark:bg-gray-700"
              placeholder="Days"
            />

          </div>

          {/* 💰 STICKY TOTAL BAR */}
          <div className="sticky bottom-0 bg-gray-100/90 dark:bg-gray-800/90 backdrop-blur pt-4 border-t border-gray-300 dark:border-gray-700">

            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-green-500">₹ {total}</span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full mt-3 bg-green-500 py-3 rounded text-lg hover:bg-green-600 transition disabled:opacity-50"
            >
              {submitting ? "Processing..." : "Confirm Booking"}
            </button>

          </div>

        </motion.div>
      </motion.div>
    </div>
  )
}

export default Booking