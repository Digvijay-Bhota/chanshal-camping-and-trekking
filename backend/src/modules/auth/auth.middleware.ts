import { Request, Response, NextFunction } from "express"
import { verifyAuthToken } from "./auth.util"

export interface AuthenticatedRequest extends Request {
  userId?: number
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

    const userId = verifyAuthToken(token)
    req.userId = userId

    next()
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" })
  }
}
