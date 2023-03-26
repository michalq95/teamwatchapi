const socketio = require("socket.io");
const io = socketio({ cors: { origin: "*" } });
const { getRoomByName, createOrJoinRoom, addVideo } = require("./roomStore");
const axios = require("axios");

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

  socket.on("track:play", (data) => {
    socket.to(data.to).emit("track:play");
  });

  socket.on("track:pause", (data) => {
    socket.to(data.to).emit("track:pause");
  });

  socket.on("track:switch", ({ playlistData, to }) => {
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
  });

  socket.on("track:add", ({ video, videoName, to }) => {
    if (video) {
      let videoLink = video;
      let room = getRoomByName(to);
      //should verify if valid youtube video
      //and name should be also taken from API
      if (videoLink.length == 11)
        videoLink = `https://www.youtube.com/watch?v=${videoLink}`;
      room.playlist.push({ name: videoName, link: videoLink });
      io.in(to).emit("room", room);
    }
  });

  socket.on("volume:change", ({ volume, to }) => {
    socket.to(to).emit("volume:change", { volume });
  });
  socket.on("track:seek", ({ seekToTime, to }) => {
    socket.to(to).emit("track:seek", { seekToTime });
  });
  socket.on("room", ({ index, to }) => {
    let room = getRoomByName(to);
    // room.playlist = playlistData.playlist;
    room.playlist = room.playlist
      .slice(0, index)
      .concat(room.playlist.slice(index + 1));
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
