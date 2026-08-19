import { Request, Response, NextFunction } from "express"
import { verifyAuthToken } from "./auth.util"

export interface AuthenticatedRequest extends Request {
  userId?: number
  userRole?: string
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void | Response {
  try {
    const token = req.cookies?.auth_token

    if (!token || typeof token !== "string") {
      return res.status(401).json({ message: "Unauthorized" })
    }

    const payload = verifyAuthToken(token)
    req.userId = payload.userId
    req.userRole = payload.role

    next()
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" })
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void | Response {
  if (!req.userId || !req.userRole) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  if (req.userRole !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admin access required" })
  }

  next()
}
