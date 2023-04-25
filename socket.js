const socketio = require("socket.io");
const io = socketio({ cors: { origin: "*" } });
const {
  getRoomByName,
  createOrJoinRoom,
  addVideo,
  toSend,
} = require("./roomStore");
const axios = require("axios");
const { RateLimiterMemory } = require("rate-limiter-flexible");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const { InMemorySessionStore } = require("./sessionStore");
const sessionStore = new InMemorySessionStore();
const User = require("./models/user");
const randomId = () => require("crypto").randomBytes(8).toString("hex");

const rateLimiter = new RateLimiterMemory({
  points: 3, // 3 points
  duration: 1, // per second
});

io.use(async (socket, next) => {
  socket.room = socket.handshake.auth.room;
  socket.password = socket.handshake.auth.password;
  const sessionID = socket.handshake.auth.sessionID;

  if (sessionID) {
    socket.sessionID = sessionID;
  } else {
    socket.sessionID = randomId();
  }
  if (socket.handshake.auth.token) {
    const decodedToken = jwt.verify(
      socket.handshake.auth.token,
      process.env.SECRET_KEY
    );
    socket.name = decodedToken.name;
    return next();
  }

  const name = socket.handshake.auth.name;
  if (!name) {
    if (process.env.NODE_ENV == "development") {
      socket.name = "Kalasanty";
      return next();
    }
    return next(new Error("invalid username"));
  }

  socket.name = name;
  next();
});

io.on("connection", async (socket) => {
  console.log(`A ${socket.name} connected to ${socket.room}`);
  socket.join(socket.room);
  let createdRoom = await createOrJoinRoom(socket.room, socket.password);
  // if (!createdRoom) {
  //   socket.emit("unauthorized");
  //   socket.disconnect(true);
  // }
  socket.emit("room:init", toSend(createdRoom));
  socket.emit("session", {
    sessionID: socket.sessionID,
  });
  if (!sessionStore.findSession(socket.sessionID)) {
    sessionStore.saveSession(socket.sessionID, {
      username: socket.name,
      room: socket.room,
      connected: true,
    });
  }
  const users = [];
  sessionStore
    .findAllSessions()
    .filter((el) => el.room == socket.room && el.connected == true)
    .forEach((session) => {
      users.push({
        username: session.username,
        connected: session.connected,
      });
    });
  socket.emit("users", users);
  socket.broadcast.emit("user connected", {
    username: socket.name,
    connected: true,
  });
  socket.to(socket.room).emit("newuserconnected", {
    username: socket.name,
  });

  socket.on(
    "track:play",
    asyncHandler(async () => {
      await rateLimiter.consume(socket.handshake.address);
      socket.to(socket.room).emit("track:play");
    })
  );

  socket.on(
    "track:pause",
    asyncHandler(async () => {
      await rateLimiter.consume(socket.handshake.address);
      socket.to(socket.room).emit("track:pause");
    })
  );

  socket.on(
    "track:switch",
    asyncHandler(async ({ playlistData }) => {
      await rateLimiter.consume(socket.handshake.address);
      let room = getRoomByName(socket.room);
      room.playlist = playlistData.playlist;

      if (playlistData.currentIndex >= room.playlist.length) {
        room.currentIndex = 0;
      } else {
        room.currentIndex = playlistData.currentIndex;
      }
      room.currentVideo = room.playlist[room.currentIndex];
      socket.emit("track:switch", toSend(room));
      socket.to(socket.room).emit("track:switch", toSend(room));

      // socket.to(to).emit("track:switch", room);
    })
  );

  socket.on("track:next", (data) => {
    if (data.currentIdIndex) {
      try {
        let currentIdIndex = data.currentIdIndex;
        let room = getRoomByName(socket.room);

        if (room.currentVideo.idIndex == currentIdIndex) {
          let nextvalue;
          if (room.nextIndex) {
            nextvalue = room.nextIndex;
            room.nextIndex = null;
          } else {
            nextvalue = Math.round(room.currentIndex + 1);
          }
          if (nextvalue >= room.playlist.length) {
            room.currentIndex = 0;
          } else {
            room.currentIndex = nextvalue;
          }
          room.currentVideo = room.playlist[room.currentIndex];
          socket.emit("track:switch", toSend(room));
          socket.to(socket.room).emit("track:switch", toSend(room));
        }
      } catch (e) {
        console.error(e);
      }
    }
  });

  socket.on("playlist:get", async ({ phrase }) => {
    try {
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${phrase}&key=${process.env.YOUTUBEAPI}`;
      const res = await axios.get(url);
      const videos = res.data.items.map((item) => ({
        title: item.snippet.title,
        id: item.snippet.resourceId.videoId,
      }));
      socket.emit("search:youtube", { videos });
    } catch (e) {
      console.error(e);
    }
  });

  socket.on("video:get", async ({ phrase }) => {
    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?id=${phrase}&key=${process.env.YOUTUBEAPI}&part=snippet`;
      const res = await axios.get(url);
      const videos = res.data.items.map((item) => ({
        title: item.snippet.title,
        id: phrase,
      }));
      socket.emit("search:youtube", { videos });
    } catch (e) {
      console.error(e);
    }
  });

  socket.on(
    "track:add",
    // asyncHandler(
    async (video) => {
      // let room = getRoomByName(socket.room);
      // room.playlist.push({
      //   name: videoName,
      //   link: videoLink,
      // });
      try {
        let room = addVideo({
          roomName: socket.room,
          videoLink: video,
          addedBy: socket.name,
        });
        io.in(socket.room).emit("room", toSend(room));
      } catch (e) {
        console.error(e);
      }
    }
  );
  // )
  socket.on(
    "tracks:add",
    // asyncHandler(
    async ({ videos }) => {
      try {
        videos.forEach((el) =>
          addVideo({
            roomName: socket.room,
            videoLink: el,
            addedBy: socket.name,
          })
        );
        const room = getRoomByName(socket.room);
        io.in(socket.room).emit("room", toSend(room));
      } catch (e) {
        console.error(e);
      }
    }
    // )
  );
  socket.on("volume:change", ({ volume }) => {
    socket.to(socket.room).emit("volume:change", { volume });
  });
  socket.on("track:seek", ({ seekToTime }) => {
    socket.to(socket.room).emit("track:seek", { seekToTime });
  });
  socket.on("track:remove", ({ index }) => {
    let room = getRoomByName(socket.room);
    // room.playlist = playlistData.playlist;
    if (index == room.currentIndex) {
      room.currentIndex -= 0.9;
      room.nextIndex = index;
    }
    room.playlist = room.playlist
      .slice(0, index)
      .concat(room.playlist.slice(index + 1));
    socket.emit("room", toSend(room));
    socket.to(socket.room).emit("room", toSend(room));
  });
  socket.on("room", async ({ playlistData }) => {
    let room = getRoomByName(socket.room);
    room.playlist = playlistData.playlist;
    socket.emit("room", toSend(room));
    socket.to(socket.room).emit("room", toSend(room));
  });

  socket.on("search:youtube", async ({ searchPhrase }) => {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?maxResults=20&key=${process.env.YOUTUBEAPI}&q=${searchPhrase}&part=snippet&type=video`;

      const res = await axios.get(url);
      const videos = res.data.items.map((item) => ({
        id: item.id.videoId,
        title: item.snippet.title,
      }));
      socket.emit("search:youtube", { videos });
    } catch (e) {
      console.error(e);
    }
  });
  socket.on("guessGame", ({ trackID, guess }) => {
    const room = getRoomByName(socket.room);
    const thevideo = room.guessGame.find((el) => el.idIndex == trackID);
    if (!thevideo.attempts.includes(socket.sessionID)) {
      thevideo.attempts.push(socket.sessionID);

      socket.emit("guessGame", { correct: guess == thevideo.addedBy });
    } else {
    }
  });

  socket.on("disconnect", async () => {
    const matchingSockets = await io.in(socket.sessionID).allSockets();
    socket.removeAllListeners();
  });
});

module.exports = io;
