import { Navigate, useLocation } from "react-router-dom"
import { ReactNode } from "react"

type Props = {
  children: ReactNode
}

function ProtectedRoute({ children }: Props) {
  const location = useLocation()
  const user = localStorage.getItem("user")

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    )
  }

  return <>{children}</>
}

export default ProtectedRoute