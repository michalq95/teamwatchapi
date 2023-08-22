const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("./user");

exports.protect = asyncHandler(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }
  if (!token) {
    res.status(401).json({ message: "Not authorized" });
  }
  // console.log(token);
  try {
    const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
    console.log("jwt verify");
    req.user = await User.findById(decodedToken.id);
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(403).json({ message: "Token has expired" });
    } else {
      console.error(err);
      return res.status(401).json({ message: "Not authorized" });
    }
  }
});
