import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { useState } from "react"
import type { Camp } from "../pages/Home"

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
}

function CampCard({ camp }: { camp: Camp }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden
                 shadow-lg hover:shadow-2xl hover:shadow-green-500/20 transition"
    >
      {/* 🖼 IMAGE */}
      <div className="relative overflow-hidden">

        <motion.img
          layoutId={`camp-image-${camp.id}`}
          src={camp.image}
          alt={camp.name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`
            h-48 w-full object-cover
            transition duration-700
            group-hover:scale-110
            ${loaded ? "blur-0 scale-100" : "blur-md scale-110"}
          `}
        />

        {/* 🌑 GRADIENT */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-70" />

        {/* ⭐ RATING */}
        <div className="absolute top-3 right-3 bg-white/90 dark:bg-gray-900/90 text-sm px-2 py-1 rounded-lg font-semibold">
          ⭐ {camp.rating}
        </div>
      </div>

      {/* 📦 CONTENT */}
      <div className="p-4 space-y-2">

        <h2 className="text-xl font-semibold line-clamp-1">
          {camp.name}
        </h2>

        <p className="text-sm opacity-70">
          📍 {camp.location}
        </p>

        <div className="flex items-center justify-between pt-2">

          <span className="text-green-500 font-bold text-lg">
            ₹{camp.price}
          </span>

          <Link to={`/booking/${camp.id}`}>
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
            >
              Book
            </motion.button>
          </Link>

        </div>
      </div>
    </motion.div>
  )
}

export default CampCard