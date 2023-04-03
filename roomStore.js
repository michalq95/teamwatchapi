let rooms = [];

function getRoomByName(name) {
  return rooms.find((room) => room.name == name);
}

function createOrJoinRoom(name) {
  let room = getRoomByName(name);
  if (!room) {
    room = {
      idIndex: 0,
      name: name,
      playlist: [],
      guessGame: [],
      currentVideo: {},
      currentIndex: 0,
      recentTrackChange: null,
    };
    rooms.push(room);
  }
  return room;
}

function getPlaylist(name) {
  let room = getRoomByName(name);
  strippedPlaylist = room.playlist.map((el) => ({
    name: el.name,
    link: el.link,
  }));
  return room.playlist;
}

function addVideo({ roomName, videoLink, addedBy }) {
  let room = getRoomByName(roomName);
  room.idIndex++;
  idIndex = room.idIndex;
  room.playlist.push({ ...videoLink, idIndex });
  room.guessGame.push({ idIndex, addedBy, attempts: [] });
  return room;
}

function toSend(room) {
  return {
    ...room,
    recentTrackChange: null,
    guessGame: [],
  };
}

module.exports = {
  getRoomByName,
  createOrJoinRoom,
  addVideo,
  getPlaylist,
  toSend,
};
