import jwt from "jsonwebtoken";

const KeyFinder = (key) => {
  switch (key) {
    case 0:
      return process.env.SECRET_TOKEN_KEY;
    case 1:
      return process.env.REFRESH_SECRET_TOKEN_KEY;
    case 2:
      return process.env.SECRET_EMAIL_KEY;
  }
};

export function generateJWT(payload, key, expiresIn) {
  key = KeyFinder(key);
  var generated;
  if (expiresIn) generated = jwt.sign(payload, key, { expiresIn });
  else generated = jwt.sign(payload, key);
  return generated;
}
export function verifyJWT(token, key) {
  key = KeyFinder(key);
  try {
    const decoded = jwt.verify(token, key);
    return { payload: decoded, expired: false };
  } catch (error) {
    return { payload: null, expired: error.message };
  }
}
