import {
  InputBuffer, CircularBuffer, DelayBuffer, DelayBufferManager, DelayedGetterRules
} from './buffers'

export type SessionRules = {
  password?: string;
  bannedUsers: { [userId: string]: boolean };
  adminUsers: { [userId: string]: boolean };
}

export type Session = {
  users: { [userId: string]: boolean };
  rules: SessionRules;
  db: DelayBuffer;
}



export class SessionManager {
  private sessions: { [sessionId: string]: Session } = {};
  private delayBufferManager: DelayBufferManager;
  private globalPollInterval: number = 1000;
  private tokens: { [userId: string]: string } = {};
  private useTokens: boolean = true; // Add useTokens boolean
  public prevState: { [sessionId: string]: { [updatedProp: string]: any } }

  public onupdate?: (
    aggregatedBuffer: { [key: string]: any },
    sessionsUpdated: { [sessionId: string]: Session }
  ) => void;

  constructor(
    globalPollInterval: number,
    onupdate?: (aggregatedBuffer: { [key: string]: any }, sessionsUpdated: { [sessionId: string]: Session }) => void,
    useTokens?: boolean // Add useTokens as a constructor parameter
  ) {
    if (globalPollInterval) this.globalPollInterval = globalPollInterval;
    if (onupdate) this.onupdate = onupdate;
    if (useTokens !== undefined) this.useTokens = useTokens; // Initialize useTokens
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
    creatorToken: string,
    delayBufferRules: DelayedGetterRules,
    sessionRules?: Partial<SessionRules>
  ) => {
    if (this.sessions[sessionId]) {
      return new Error(`Session with ID ${sessionId} already exists`);
    }

    if (this.useTokens && (!this.tokens[creatorId] || this.tokens[creatorId] !== creatorToken)) {
      return new Error(`Invalid token for user ${creatorId}`);
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

    this.addUserToSession(sessionId, creatorId, creatorToken, sessionRules?.password);
  }

  deleteSession = (sessionId: string, adminId: string, adminToken: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (this.checkAdmin(sessionId, adminId, adminToken) || Object.keys(session.rules.adminUsers).length === 0 || Object.keys(session.users).length === 0) {
      this.delayBufferManager.deleteBuffer(sessionId);
      delete this.sessions[sessionId];
    }
  }

  getSessionInfo = (sessionId: string, userId: string, userToken: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (this.useTokens && (!this.tokens[userId] || this.tokens[userId] !== userToken)) {
      return new Error(`Invalid token for user ${userId}`);
    }

    const dbrules = this.delayBufferManager.get(sessionId)?._rules;

    return {
      _id: sessionId,
      users: Object.keys(session.users),
      dbrules
    };
  }

  private checkAdmin(sessionId: string, userId: string, adminToken: string) {
    const session = this.sessions[sessionId];
    if (this.useTokens && (!session.rules.adminUsers[userId] || this.tokens[userId] !== adminToken)) {
      console.error(`User ${userId} does not have admin privileges or invalid token`);
      return false;
    }
    return true;
  }

  updateSessions = (
    updates: { [sessionId: string]: { [key: string]: any }; },
    userId?: string,
    userToken?: string,
    passwords?: { [key: string]: string },
    adminId?: string,
    adminToken?: string
  ) => {
    for (const key in updates) {
      this.updateBuffer(key, updates[key], userId, userToken, passwords?.[key], adminId, adminToken);
    }
  }

  updateBuffer = (
    sessionId: string,
    updates: { [key: string]: any; },
    userId?: string,
    userToken?: string,
    password?: string,
    adminId?: string,
    adminToken?: string
  ) => {
    let session = this.sessions[sessionId];
    if (
      session && (!this.useTokens || 
        (userId && session.users[userId] && (this.tokens[userId] === userToken)) ||
        (adminId && this.checkAdmin(sessionId, adminId, adminToken)) ||
        (session.rules.password && session.rules.password === password)
      )
    ) {
      this.delayBufferManager.updateBuffer(sessionId, updates);
    }
  };

  addUserToSession = (
    sessionId: string,
    userId: string,
    userToken: string,
    password?: string,
    dbrules?: DelayedGetterRules, // e.g. add specific keys that the user will be updating
    adminId?: string,
    adminToken?: string
  ) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (session.rules.password && session.rules.password !== password || (adminToken && !this.checkAdmin(sessionId, adminId, adminToken))) {
      return new Error(`Password required or invalid admin token`);
    }

    if (session.rules.bannedUsers && session.rules.bannedUsers[userId]) {
      return new Error(`User ${userId} is banned from this session`);
    }

    if (this.useTokens && (!this.tokens[userId] || this.tokens[userId] !== userToken)) {
      return new Error(`Invalid token for user ${userId}`);
    }

    session.users[userId] = true;
    if (dbrules) {
      session.db.setRules(dbrules);
    }
  }

  removeUserFromSession = (sessionId: string, userId: string, adminId: string, adminToken: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (session.users[userId] && this.checkAdmin(sessionId, adminId, adminToken)) {
      delete session.users[userId];
    }
  }

  setAdmin = (sessionId: string, adminId: string, adminToken: string, userId: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (this.checkAdmin(sessionId, adminId, adminToken)) {
      session.rules.adminUsers[userId] = true;
    }
  }

  removeAdmin = (sessionId: string, adminId: string, adminToken: string, userId: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (Object.keys(session.rules.adminUsers).length > 1 && this.checkAdmin(sessionId, adminId, adminToken)) {
      delete session.rules.adminUsers[userId];
    }
  }

  banUser = (sessionId: string, adminId: string, adminToken: string, userId: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (this.checkAdmin(sessionId, adminId, adminToken)) {
      session.rules.bannedUsers[userId] = true;
      this.removeUserFromSession(sessionId, userId, adminId, adminToken);
    }
  }

  unbanUser = (sessionId: string, adminId: string, adminToken: string, userId: string) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return new Error(`Session with ID ${sessionId} does not exist`);
    }

    if (this.checkAdmin(sessionId, adminId, adminToken)) {
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

  setSessionToken = (userId: string, token: string) => {
    this.tokens[userId] = token;
  }

  generateSessionToken = (userId?: string) => {
    const token = `${Math.floor(Math.random() * 1000000000000000)}`;
    if (userId) {
      this.tokens[userId] = token;
    }
    return token;
  }
}
