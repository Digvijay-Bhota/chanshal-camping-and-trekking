import { motion } from "framer-motion"
import { ReactNode } from "react"

type Props = {
  children: ReactNode
}

const pageVariants = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -40 },
}

function PageWrapper({ children }: Props) {
  return (
    <motion.main
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: 0.4,
        ease: "easeInOut",
      }}
      className="min-h-screen"
    >
      {children}
    </motion.main>
  )
}

export default PageWrapper