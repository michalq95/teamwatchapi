const socketio = require("socket.io");
const io = socketio({ cors: { origin: "*" } });
const { getRoomByName, createOrJoinRoom, addVideo } = require("./roomStore");
const axios = require("axios");
const { RateLimiterMemory } = require("rate-limiter-flexible");
const asyncHandler = require("express-async-handler");

const rateLimiter = new RateLimiterMemory({
  points: 3, // 3 points
  duration: 1, // per second
});

io.use(async (socket, next) => {
  socket.username = socket.handshake.auth.username;
  socket.room = socket.handshake.auth.room;
  next();
});

io.on("connection", async (socket) => {
  console.log(`A user connected to room ${socket.room}`);
  socket.join(socket.room);
  const createdRoom = createOrJoinRoom(socket.room);
  socket.emit("track:switch", createdRoom);
  socket.to(socket.room).emit("newuserconnected", {
    username: socket.username,
  });

  socket.on("track:play", async (data) => {
    try {
      await rateLimiter.consume(socket.handshake.address);
      socket.to(data.to).emit("track:play");
    } catch (rejRes) {
      socket.emit("blocked", { "retry-ms": rejRes.msBeforeNext });
    }
  });

  socket.on("track:pause", async (data) => {
    try {
      await rateLimiter.consume(socket.handshake.address);
      socket.to(data.to).emit("track:pause");
    } catch (rejRes) {
      socket.emit("blocked", { "retry-ms": rejRes.msBeforeNext });
    }
  });

  socket.on("track:switch", async ({ playlistData, to }) => {
    try {
      await rateLimiter.consume(socket.handshake.address);
      let room = getRoomByName(to);
      room.playlist = playlistData.playlist;

      if (playlistData.currentIndex >= room.playlist.length) {
        room.currentIndex = 0;
      } else {
        room.currentIndex = playlistData.currentIndex;
      }

      room.currentVideo = room.playlist[room.currentIndex];
      socket.emit("track:switch", room);

      socket.to(to).emit("track:switch", room);
    } catch (rejRes) {
      socket.emit("blocked", { "retry-ms": rejRes.msBeforeNext });
    }
  });

  socket.on("playlist:get", async ({ phrase }) => {
    // let room = getRoomByName(to);
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${phrase}&key=${process.env.YOUTUBEAPI}`;
    try {
      const res = await axios.get(url);
      const videos = res.data.items.map((item) => ({
        title: item.snippet.title,
        id: item.snippet.resourceId.videoId,
      }));
      // console.log(videos);
      socket.emit("search:youtube", { videos });
    } catch (e) {
      console.log(e);
    }
  });

  socket.on("video:get", async ({ phrase }) => {
    // let room = getRoomByName(to);
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${phrase}&key=${process.env.YOUTUBEAPI}&part=snippet`;
    try {
      const res = await axios.get(url);
      const videos = res.data.items.map((item) => ({
        title: item.snippet.title,
        id: phrase,
      }));
      socket.emit("search:youtube", { videos });
    } catch (e) {
      console.log(e);
    }
  });

  socket.on("track:add", async ({ video, videoName, to }) => {
    if (video) {
      let videoLink = video;
      let room = getRoomByName(to);
      // let match = videoLink.match(/&list=([^&]*)/);
      // let playlistName = match ? match[1] : null;

      // if (videoLink.length == 11)
      //   videoLink = `https://www.youtube.com/watch?v=${videoLink}`;
      // if (playlistName) {
      //   const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistName}&key=${process.env.YOUTUBEAPI}`;

      //   try {
      //     const res = await axios.get(url);
      //     const videos = res.data.items.map((item) => ({
      //       name: item.snippet.title,
      //       link: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
      //     }));
      //     console.log(videos);
      //     videos.forEach((el) => room.playlist.push(el));
      //     io.in(to).emit("room", room);
      //   } catch (e) {
      //     console.log(e);
      //   }
      // } else {
      room.playlist.push({ name: videoName, link: videoLink });
      io.in(to).emit("room", room);
      // }
    }
  });

  socket.on(
    "tracks:add",
    asyncHandler(async ({ videos, to }) => {
      let room = getRoomByName(to);
      videos.forEach((el) => room.playlist.push(el));
      io.in(to).emit("room", room);
    })
  );
  socket.on("volume:change", ({ volume, to }) => {
    socket.to(to).emit("volume:change", { volume });
  });
  socket.on("track:seek", ({ seekToTime, to }) => {
    socket.to(to).emit("track:seek", { seekToTime });
  });
  socket.on("track:remove", ({ index, to }) => {
    let room = getRoomByName(to);
    // room.playlist = playlistData.playlist;
    room.playlist = room.playlist
      .slice(0, index)
      .concat(room.playlist.slice(index + 1));
    socket.emit("room", room);
    socket.to(to).emit("room", room);
  });
  socket.on("room", async ({ playlistData, to }) => {
    let room = getRoomByName(to);
    room.playlist = playlistData.playlist;
    socket.emit("room", room);
    socket.to(to).emit("room", room);
  });

  socket.on("search:youtube", async ({ searchPhrase }) => {
    const url = `https://www.googleapis.com/youtube/v3/search?maxResults=20&key=${process.env.YOUTUBEAPI}&q=${searchPhrase}&part=snippet&type=video`;

    try {
      const res = await axios.get(url);
      const videos = res.data.items.map((item) => ({
        id: item.id.videoId,
        title: item.snippet.title,
      }));
      socket.emit("search:youtube", { videos });
    } catch (e) {
      console.log(e);
    }
  });
});

module.exports = io;
