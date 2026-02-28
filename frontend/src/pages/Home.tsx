import { useEffect, useState } from "react"
import Hero from "../components/Hero"
import CampCard from "../components/CampCard"
import { motion } from "framer-motion"
import CampCardSkeleton from "../components/CampCardSkeleton"
const API =
  import.meta.env.VITE_API_URL || "http://localhost:4000"

export type Camp = {
  id: number
  name: string
  price: number
  location: string
  rating: number
  image: string
}

/* 🔥 STAGGER CONTAINER */
const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.15,
    },
  },
}

function Home() {
  const [camps, setCamps] = useState<Camp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadCamps = async () => {
      try {
        const res = await fetch(`${API}/api/camps`, {
          signal: controller.signal,
        })

        if (!res.ok) throw new Error("Failed to fetch camps")

        const data = await res.json()
        setCamps(data)
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message)
        }
      } finally {
        setLoading(false)
      }
    }

    loadCamps()
    return () => controller.abort()
  }, [])

  return (
    <div className="bg-white text-black dark:bg-gray-900 dark:text-white">

      <Hero />

      <div className="container py-10">

        <h1 className="text-3xl mb-8 font-bold text-center">
          Popular Camps
        </h1>

        {/* ⛺ LOADING SKELETON */}
       {loading && (
  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: 6 }).map((_, i) => (
      <CampCardSkeleton key={i} />
    ))}
  </div>
)}

        {/* ❌ ERROR */}
        {error && (
          <div className="text-center text-red-500 text-lg">
            {error}
          </div>
        )}

        {/* ✅ CAMPS WITH STAGGER */}
        {!loading && !error && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {camps.map((camp) => (
              <CampCard key={camp.id} camp={camp} />
            ))}
          </motion.div>
        )}

      </div>
    </div>
  )
}

export default Home