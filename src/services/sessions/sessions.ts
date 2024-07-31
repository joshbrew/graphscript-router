import {
  InputBuffer, CircularBuffer, DelayBuffer, DelayBufferManager, DelayedGetterRules
} from './buffers'

interface SessionRules {
  password?: string;
  bannedUsers: { [userId: string]: boolean };
  adminUsers: { [userId: string]: boolean };
}

interface Session {
  users: { [userId: string]: boolean };
  rules: SessionRules;
  db: DelayBuffer;
}



//todo add user tokens so we can verify requests
export class SessionManager {
  private sessions: { [sessionId: string]: Session } = {};
  private delayBufferManager: DelayBufferManager;
  private globalPollInterval: number = 1000;
  public prevState: { [sessionId: string]: { [updatedProp: string]: any } }

  public onupdate?: (
    aggregatedBuffer: { [key: string]: any },
    sessionsUpdated: { [sessionId: string]: Session }
  ) => void;

  constructor(
    globalPollInterval: number,
    onupdate?: (aggregatedBuffer: { [key: string]: any }, sessionsUpdated: { [sessionId: string]: Session }) => void
  ) {
    if (globalPollInterval) this.globalPollInterval = globalPollInterval;
    if (onupdate) this.onupdate = onupdate;
    this.delayBufferManager = new DelayBufferManager(this.globalPollInterval);
    this.delayBufferManager.onupdate = (aggregateBuffers) => {
      if (this.onupdate) {
        let updateKeys = Object.keys(aggregateBuffers);
        let sessionsUpdated: { [sessionId: string]: Session } = {};
        updateKeys.forEach((id) => {
          sessionsUpdated[id] = this.sessions[id];
        });
        this.prevState = aggregateBuffers; //save prevState
        this.onupdate(aggregateBuffers, sessionsUpdated);
      } else {
        console.log("Buffers updated:", aggregateBuffers);
      }
    };
  }

  createSession = (
    sessionId: string,
    creatorId: string,
    delayBufferRules: DelayedGetterRules,
    sessionRules?: Partial<SessionRules>
  ) => {

    if (this.sessions[sessionId]) {
      return new Error(`Session with ID ${sessionId} already exists`);
    }

    this.delayBufferManager.createBuffer(sessionId, delayBufferRules);

    const rules: SessionRules = {
      password: sessionRules?.password,
      bannedUsers: sessionRules?.bannedUsers || {},
      adminUsers: sessionRules?.adminUsers || {},
    };

    rules.adminUsers[creatorId] = true; // Creator is an admin by default

    this.sessions[sessionId] = {
      users: {},
      rules,
      db: this.delayBufferManager.get(sessionId) as DelayBuffer
    };

    this.addUserToSession(sessionId, creatorId, sessionRules?.password);
  }

  deleteSession = (sessionId: string, adminId: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (this.checkAdmin(sessionId, adminId) || Object.keys(session.rules.adminUsers).length === 0 || Object.keys(session.users).length === 0) {
      this.delayBufferManager.deleteBuffer(sessionId);
      delete this.sessions[sessionId];
    }
  }

  getSessionInfo = (sessionId: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    const dbrules = this.delayBufferManager.get(sessionId)?._rules;

    return {
      _id: sessionId,
      users: Object.keys(session.users),
      dbrules
    };
  }

  private checkAdmin(sessionId: string, userId: string) {
    const session = this.sessions[sessionId];
    if (!session.rules.adminUsers[userId]) {
      console.error(`User ${userId} does not have admin privileges`);
      return false;
    }
    return true;
  }

  updateSessions = (
    updates: { [sessionId: string]: { [key: string]: any }; },
    userId?: string,
    passwords?: { [key: string]: string },
    admin?: string
  ) => {
    for (const key in updates) {
      this.updateBuffer(key, updates[key], userId, passwords?.[key], admin);
    }
  }

  updateBuffer = (
    sessionId: string,
    updates: { [key: string]: any; },
    userId?: string,
    password?: string,
    admin?: string
  ) => {
    let session = this.sessions[sessionId];
    //console.log(session);
    if (
      session && (
        (userId && session.users[userId]) ||
        (admin && session.rules.adminUsers[admin]) ||
        (session.rules.password && session.rules.password === password)
      )
    ) {
      this.delayBufferManager.updateBuffer(sessionId, updates);
    }
  };

  addUserToSession = (
    sessionId: string,
    userId: string,
    password?: string,
    admin?: string,
    dbrules?: DelayedGetterRules // e.g. add specific keys that the user will be updating
  ) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (session.rules.password && session.rules.password !== password || (admin && session.rules.adminUsers[admin])) {
      return new Error(`Password required`);
    }

    if (session.rules.bannedUsers && session.rules.bannedUsers[userId]) {
      return new Error(`User ${userId} is banned from this session`);
    }

    session.users[userId] = true;
    if (dbrules) {
      session.db.setRules(dbrules);
    }
  }

  removeUserFromSession = (sessionId: string, userId: string, adminId: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (session.users[userId] || this.checkAdmin(sessionId, adminId) || Object.keys(session.rules.adminUsers).length === 0) {
      delete session.users[userId];
    }
  }

  setAdmin = (sessionId: string, adminId: string, userId: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (this.checkAdmin(sessionId, adminId)) {
      session.rules.adminUsers[userId] = true;
    }
  }

  removeAdmin = (sessionId: string, adminId: string, userId: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (Object.keys(session.rules.adminUsers).length > 1 && this.checkAdmin(sessionId, adminId)) {
      delete session.rules.adminUsers[userId];
    }
  }

  banUser = (sessionId: string, adminId: string, userId: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (this.checkAdmin(sessionId, adminId)) {
      session.rules.bannedUsers[userId] = true;
      this.removeUserFromSession(sessionId, userId, adminId);
    }
  }

  unbanUser = (sessionId: string, adminId: string, userId: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (this.checkAdmin(sessionId, adminId)) {
      delete session.rules.bannedUsers[userId];
    }
  }

  splitUpdatesByUser = (aggregatedBuffers: { [key: string]: any }) => {
    const userUpdates: { [userId: string]: { [sessionId: string]: any } } = {};

    Object.keys(aggregatedBuffers).forEach(sessionId => {
      const session = this.sessions[sessionId];
      if (!session) return;
      const sessionUpdates = aggregatedBuffers[sessionId];

      if (sessionUpdates) {
        Object.keys(session.users).forEach(userId => {
          if (!userUpdates[userId]) {
            userUpdates[userId] = {};
          }
          userUpdates[userId][sessionId] = sessionUpdates;
        });
      }
    });

    return userUpdates;
  }

  startPolling = () => {
    this.delayBufferManager.startPolling();
  }

  stopPolling = () => {
    this.delayBufferManager.stopPolling();
  }
}

