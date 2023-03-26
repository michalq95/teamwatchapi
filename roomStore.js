let rooms = [];

function getRoomByName(name) {
  return rooms.find((room) => room.name == name);
}

function createOrJoinRoom(name) {
  let room = getRoomByName(name);
  if (!room) {
    room = {
      name: name,
      playlist: [],
      currentVideo: {},
      currentIndex: 0,
    };
    rooms.push(room);
  }
  return room;
}

function addVideo({ roomName, videoLink }) {
  let room = getRoomByName(roomName);
  room.playlist.push(videoLink);
  return room;
}

module.exports = {
  getRoomByName,
  createOrJoinRoom,
  addVideo,
};
