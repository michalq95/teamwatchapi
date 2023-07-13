const express = require("express");
const User = require("../models/user.js");
const asyncHandler = require("express-async-handler");
const { protect } = require("./middleware");
const { getRoomByName } = require("../roomStore");
const bcrypt = require("bcrypt");

const router = express.Router();
router.post(
  "/register",
  // asyncHandler(async
  async (req, res, next) => {
    try {
      const { name, email, password } = req.body;
      const user = new User({
        name,
        email,
        password,
        playlists: [{ name: "default", playlist: [] }],
      });
      await user.save();

      sendTokenResponse(user, 200, res);
    } catch (e) {
      if (e.code == 11000) {
        if ("name" in e.keyPattern) {
          res.status(401).json({ success: false });
          return;
        }
        if ("email" in e.keyPattern) {
          res.status(403).json({ success: false });
          return;
        }
      }
      res.status(500).json({ success: false });
      return;
    }
  }
  // )
);

router.post("/login", async (req, res, next) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).send("Name and password are required.");
    }
    let user = await User.findOne({ name: name }).select("+password");
    console.log(user);
    if (!user) {
      return res.status(400).send("Invalid name or password.");
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).send("Invalid name or password.");
    }
    sendTokenResponse(user, 200, res);
  } catch (e) {
    console.error(e);
    next(e);
  }
});

router
  .route("/library")
  .get(
    protect,
    asyncHandler(async (req, res) => {
      let user = await User.findById(req.user.id);
      return res.status(200).json({ data: user.playlists });
    })
  )
  .post(
    protect,
    asyncHandler(async (req, res, next) => {
      let user = await User.findByIdAndUpdate(
        req.user.id,
        { playlists: req.body },
        { new: true, runValidators: true }
      );
      return res.status(200).json({ data: user.playlists });
    })
  );

router.route("/room").post(
  asyncHandler(async (req, res, next) => {
    const room = getRoomByName(req.body.room);
    const password = req.body.password;
    if (!room) {
      return res.status(200).json({ password });
    }

    // const status = await bcrypt.compare(password, room.password);
    if (password == room.password) {
      return res.status(200).json({ password });
    }
    return res.status(401);
  })
);

module.exports = router;

const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();
  const options = {
    expiresIn: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "production") {
    options.secure = true;
  }

  const payload = {
    success: true,
    user: {
      name: user.name,
      id: user._id,
      playlists: user.playlists,
    },
    token,
  };

  return res.status(statusCode).cookie("token", token, options).json(payload);
};
