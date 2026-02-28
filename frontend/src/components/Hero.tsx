import { motion } from "framer-motion"

function Hero() {
  const scrollToCamps = () => {
    const section = document.getElementById("camps")
    section?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div className="relative h-[90vh] w-full overflow-hidden">

      {/* 🖼 BACKGROUND IMAGE */}
      <img
        src="https://images.unsplash.com/photo-1501785888041-af3ef285b470"
        alt="Chanshal Valley"
        loading="eager"
        className="absolute inset-0 w-full h-full object-cover scale-105"
      />

      {/* 🌑 GRADIENT OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

      {/* ✨ CONTENT */}
      <div className="relative z-10 flex flex-col justify-center items-center h-full text-center text-white px-4">

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-6xl font-bold mb-4 leading-tight"
        >
          Explore Chanshal Valley 🏔️
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="max-w-2xl text-lg text-gray-200 mb-6"
        >
          Book camps, treks & unforgettable mountain experiences.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          onClick={scrollToCamps}
          className="bg-green-500 px-8 py-3 rounded-xl text-lg
                     hover:bg-green-600 transition
                     shadow-lg hover:scale-105"
        >
          Start Your Journey
        </motion.button>

      </div>
    </div>
  )
}

export default Hero