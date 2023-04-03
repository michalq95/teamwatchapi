class RoomStore {
  constructor() {
    this.rooms = new Map();
  }

  findSession(id) {
    return this.rooms.get(id);
  }

  saveSession(id, session) {
    this.sessions.set(id, session);
  }

  findAllSessions() {
    return [...this.sessions.values()];
  }
}
module.exports = {
  InMemorySessionStore,
};
