import jwt from "jsonwebtoken";
import { db } from "../index.js";
import { verifyJWT, generateJWT } from "./jwt.utils.js";

export function UserChecker(req, res, next) {
  const { authToken, refreshToken } = req.cookies;
  if (!authToken && !refreshToken) return next();
  const { payload, expired } = verifyJWT(authToken, 0);
  if (payload) {
    req.user = payload;
    return next();
  }
  const checkRefreshQuery = "SELECT refreshtoken FROM forum_refreshtoken WHERE refreshtoken = ?";
  db.query(checkRefreshQuery, [refreshToken], function (error, result) {
    if (error) return res.status(400).json({ error });
    if (result && result.length < 1) return next();
    const { payload: refresh } = expired && refreshToken ? verifyJWT(refreshToken, 1) : { payload: null };
    if (!refresh) {
      return next();
    }
    const getUserQuery = "SELECT * FROM forum_accounts WHERE id = ?"
    db.query(getUserQuery, [refresh.id],function(error, result) {
    if (error) return res.status(400).json({ error });

      const { id, whitelist, username, isAdmin, isModerator, steam, discord } = result[0];
      const newAuthToken = generateJWT({ id, whitelist, username, isAdmin, isModerator, steam, discord }, 0, "5m");
      res.cookie("authToken", newAuthToken, { maxAge: 1000000, httpOnly: true, secure: true, sameSite: 'none' });
      req.user = { id, whitelist, username, isAdmin, isModerator, steam, discord };
      next();
    })
  });
}

export function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(403).json({ error: "Invalid User" });
  }
  next();
}
