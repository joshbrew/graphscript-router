export class StreamServer {
  constructor(pushInterval = 1000, pollInterval = 10) {
    this.users = {};
    this.sessions = {};
    this.pushBuffer = {};
    this.stateBuffer = {};
    this.lastState = {};

    this.pushInterval = pushInterval || 1000;
    this.pollInterval = pollInterval || 10;

    if (pushInterval) setInterval(this.pushUpdates.bind(this), this.pushInterval);
    if (pollInterval) setInterval(this.pollSubscribers.bind(this), this.pollInterval);
  }

  addUser(userId, sendHandler, isRemote = false) {
    if (!this.users[userId]) {
      this.users[userId] = {
        _id: userId,
        sessions: {},
        sessionSubs: {},
        updateBuffer: {},
        send: sendHandler || this.defaultSendMethod.bind(this),
      };
      if (isRemote) {
        this.sendToRemote(userId, { route: 'addUser', args: [userId] });
      }
    }
  }

  defaultSendMethod({ route, args }) {
    if (route === 'sendDataToSubscriber') {
      this.sendDataToSubscriber(...args);
    } else if (route === 'updateUserProperties') {
      this.localUpdateUserProperties(...args);
    } else if (route === 'unsubscribe') {
      this.localUnsubscribe(...args);
    }
  }

  removeUser(userId, isRemote = false) {
    if (isRemote) {
      this.sendToRemote(userId, { route: 'removeUser', args: [userId] });
      return;
    }
    if (this.users[userId]) {
      for (let sessionId in this.sessions) {
        this.localUnsubscribe(userId, sessionId);
      }
      delete this.users[userId];
    }
  }

  createSession(userId, sessionSettings, isRemote = false) {
    if (isRemote) {
      this.sendToRemote(userId, { route: 'createSession', args: [userId, sessionSettings] });
      return;
    }
    if (!this.users[userId]) {
      throw new Error(`User ${userId} does not exist`);
    }

    const sessionId = sessionSettings.sessionId || `session-${Object.keys(this.sessions).length + 1}`;
    const session = {
      _id: sessionId,
      settings: {
        ...sessionSettings,
        users: {},
        maxUsers: sessionSettings.maxUsers || Infinity,
      },
      bannedUsers: {},
      admins: { [userId]: true },
      owners: { [userId]: true },
      host: sessionSettings.host || null,
      hostProps: sessionSettings.hostProps || {},
    };

    this.sessions[sessionId] = session;
    return sessionId;
  }

  listSessions(userId = null) {
    const sessions = Object.values(this.sessions).map(session => ({
      sessionId: session._id,
      name: session.settings.name,
      userCount: Object.keys(session.settings.users).length,
      maxUsers: session.settings.maxUsers,
    }));

    if (userId && this.users[userId]) {
      this.users[userId].send({ route: 'listSessions', args: [sessions] });
    }
    return sessions;
  }

  hasPassword(sessionId, userId = null) {
    const session = this.sessions[sessionId];
    const hasPassword = session && session.settings.password ? true : false;
    
    if (userId && this.users[userId]) {
      this.users[userId].send({ route: 'hasPassword', args: [sessionId, hasPassword] });
    }
    return hasPassword;
  }

  setHost(sessionId, userId, isRemote = false) {
    if (isRemote) {
      this.sendToRemote(userId, { route: 'setHost', args: [sessionId, userId] });
      return;
    }
    const session = this.sessions[sessionId];
    if (session && session.settings.users[userId]) {
      session.host = userId;
      session.hostProps = {};
    }
  }

  setAdmin(sessionId, userId, newAdminId, isRemote = false) {
    if (isRemote) {
      this.sendToRemote(userId, { route: 'setAdmin', args: [sessionId, userId, newAdminId] });
      return;
    }
    const session = this.sessions[sessionId];
    if (session && session.admins[userId]) {
      session.admins[newAdminId] = true;
    }
  }

  removeAdmin(sessionId, userId, adminId, isRemote = false) {
    if (isRemote) {
      this.sendToRemote(userId, { route: 'removeAdmin', args: [sessionId, userId, adminId] });
      return;
    }
    const session = this.sessions[sessionId];
    if (session && session.admins[userId]) {
      delete session.admins[adminId];
    }
  }

  subscribe(userId, sessionId, password, onmessage, onclose, isRemote = false) {
    if (isRemote) {
      this.sendToRemote(userId, { route: 'subscribe', args: [userId, sessionId, password] });
      return;
    }
    const session = this.sessions[sessionId];
    if (session) {
      if (this.hasPassword(sessionId) && session.settings.password !== password) {
        throw new Error('Invalid password');
      }
  
      if (session.bannedUsers[userId]) {
        throw new Error('User is banned from this session');
      }
  
      if (Object.keys(session.settings.users).length >= session.settings.maxUsers) {
        throw new Error('Session is full');
      }
  
      session.settings.users[userId] = true;
      this.users[userId].sessions[sessionId] = session;
  
      this.users[userId].sessionSubs[sessionId] = {
        onmessage: onmessage || ((session, data) => {}),
        onclose: onclose || (() => { this.localUnsubscribe(userId, sessionId); })
      };
  
      console.log(`User ${userId} subscribed to session ${sessionId}`); // Debugging statement
  
      // Send the last state to the new subscriber
      if (this.lastState[sessionId]) {
        this.sendDataToSubscriber(userId, sessionId, this.lastState[sessionId]);
      }
    } else {
      console.log(`Session ${sessionId} not found for subscription`); // Debugging statement
    }
  }
  
  
  

  localUnsubscribe(userId, sessionId, isRemote = false) {
    if (isRemote) {
      this.sendToRemote(userId, { route: 'unsubscribe', args: [userId, sessionId] });
      return;
    }
    const session = this.sessions[sessionId];
    if (session) {
      delete session.settings.users[userId];
      delete this.users[userId].sessions[sessionId];
      if (this.users[userId].sessionSubs[sessionId]) {
        const onclose = this.users[userId].sessionSubs[sessionId].onclose;
        delete this.users[userId].sessionSubs[sessionId];
        if (onclose) {
          onclose();
        }
      }

      if (session.host === userId) {
        session.host = null;
      }
    }
  }

  unsubscribe(userId, sessionId, isRemote = false) {
    if (isRemote) {
      this.sendToRemote(userId, { route: 'unsubscribe', args: [userId, sessionId] });
      return;
    }
    this.localUnsubscribe(userId, sessionId);
  }

  kickUser(adminId, userId, sessionId, isRemote = false) {
    if (isRemote) {
      this.sendToRemote(adminId, { route: 'kickUser', args: [adminId, userId, sessionId] });
      return;
    }
    const session = this.sessions[sessionId];
    if (session && (session.admins[adminId] || session.owners[adminId])) {
      this.unsubscribe(userId, sessionId);
      this.banUser(adminId, userId, sessionId);
    } else {
      throw new Error('Permission denied');
    }
  }

  banUser(adminId, userId, sessionId, isRemote = false) {
    if (isRemote) {
      this.sendToRemote(adminId, { route: 'banUser', args: [adminId, userId, sessionId] });
      return;
    }
    const session = this.sessions[sessionId];
    if (session && (session.admins[adminId] || session.owners[adminId])) {
      session.bannedUsers[userId] = true;
      this.unsubscribe(userId, sessionId);
    } else {
      throw new Error('Permission denied');
    }
  }

  unbanUser(adminId, userId, sessionId, isRemote = false) {
    if (isRemote) {
      this.sendToRemote(adminId, { route: 'unbanUser', args: [adminId, userId, sessionId] });
      return;
    }
    const session = this.sessions[sessionId];
    if (session && (session.admins[adminId] || session.owners[adminId])) {
      delete session.bannedUsers[userId];
      this.subscribe(userId, sessionId);
    } else {
      throw new Error('Permission denied');
    }
  }

  updateUserProperties(userId, newProperties, bufferOnly = false, isRemote = false) {
    if (isRemote) {
      this.sendToRemote(userId, { route: 'updateUserProperties', args: [userId, newProperties, bufferOnly] });
      return;
    }
    this.localUpdateUserProperties(userId, newProperties, bufferOnly);
  }
  
  localUpdateUserProperties(userId, newProperties, bufferOnly = false) {
    if (!this.users[userId]) this.users[userId] = {};
  
    const currentProperties = this.users[userId];
    const updatedProperties = {};
  
    for (let key in newProperties) {
      if (currentProperties[key] !== newProperties[key]) {
        if (Array.isArray(newProperties[key])) {
          updatedProperties[key] = newProperties[key];
        } else if (typeof newProperties[key] === 'object') {
          updatedProperties[key] = { ...currentProperties[key], ...newProperties[key] };
        } else {
          updatedProperties[key] = newProperties[key];
        }
        this.lastState[userId] = this.lastState[userId] || {};
        this.lastState[userId][key] = newProperties[key];
      }
    }
  
    if (Object.keys(updatedProperties).length > 0) {
      if (!bufferOnly) {
        Object.assign(this.users[userId], updatedProperties);
        this.bufferState(userId, updatedProperties);
      }
      this.bufferUpdates(userId, updatedProperties);
    }
  }
  
  bufferUpdates(userId, updatedProperties) {
    if (!this.pushBuffer[userId]) {
      this.pushBuffer[userId] = {};
    }
    for (let key in updatedProperties) {
      if (Array.isArray(updatedProperties[key])) {
        this.pushBuffer[userId][key] = this.pushBuffer[userId][key] || [];
        this.pushBuffer[userId][key].push(...updatedProperties[key]);
      } else if (typeof updatedProperties[key] === 'object') {
        this.pushBuffer[userId][key] = { ...this.pushBuffer[userId][key], ...updatedProperties[key] };
      } else {
        this.pushBuffer[userId][key] = updatedProperties[key];
      }
    }
  }
  

  bufferState(userId, updatedProperties) {
    if (!this.stateBuffer[userId]) {
      this.stateBuffer[userId] = {};
    }
    Object.assign(this.stateBuffer[userId], updatedProperties);
  }

  pushUpdates() {
    const sessionUpdates = {};
  
    // Collect updates for each session
    for (let userId in this.pushBuffer) {
      const updatedProperties = this.pushBuffer[userId];
      const user = this.users[userId];
  
      for (let sessionId in user.sessions) {
        if (!sessionUpdates[sessionId]) {
          sessionUpdates[sessionId] = {};
        }
  
        for (let key in updatedProperties) {
          if (!sessionUpdates[sessionId][key]) {
            sessionUpdates[sessionId][key] = {};
          }
          sessionUpdates[sessionId][key][userId] = updatedProperties[key];
        }
      }
    }
  
    // Distribute updates to all users in each session
    for (let sessionId in sessionUpdates) {
      const session = this.sessions[sessionId];
      const updates = sessionUpdates[sessionId];
  
      for (let userId in session.settings.users) {
        const user = this.users[userId];
        console.log(`Pushing updates to ${userId} in session ${sessionId}`, updates); // Add this line for debugging
  
        if (user && user.send && user.send !== this.defaultSendMethod) {
          user.send({ route: 'sendDataToSubscriber', args: [sessionId, updates] });
        } else {
          this.sendDataToSubscriber(userId, sessionId, updates);
        }
      }
    }
  
    this.pushBuffer = {}; // Clear the buffer after pushing updates
  }
  


  pushToStreams(userId, updatedProperties) {
    const user = this.users[userId];
    for (let sessionId in user.sessions) {
      const session = user.sessions[sessionId];
      const host = session.host;
      for (let subscriberId in session.settings.users) {
        if (subscriberId !== userId) {
          if (!this.users[subscriberId].updateBuffer) {
            this.users[subscriberId].updateBuffer = {};
          }
          for (let key in updatedProperties) {
            if (Array.isArray(updatedProperties[key])) {
              this.users[subscriberId].updateBuffer[sessionId] = this.users[subscriberId].updateBuffer[sessionId] || {};
              this.users[subscriberId].updateBuffer[sessionId][key] = this.users[subscriberId].updateBuffer[sessionId][key] || [];
              this.users[subscriberId].updateBuffer[sessionId][key].push(...updatedProperties[key]);
            } else if (typeof updatedProperties[key] === 'object') {
              this.users[subscriberId].updateBuffer[sessionId] = this.users[subscriberId].updateBuffer[sessionId] || {};
              this.users[subscriberId].updateBuffer[sessionId][key] = { ...this.users[subscriberId].updateBuffer[sessionId][key], ...updatedProperties[key] };
            } else {
              this.users[subscriberId].updateBuffer[sessionId] = this.users[subscriberId].updateBuffer[sessionId] || {};
              this.users[subscriberId].updateBuffer[sessionId][key] = updatedProperties[key];
            }
          }
          if (host) {
            if (host === userId && subscriberId !== host) {
              this.users[subscriberId].updateBuffer[sessionId] = updatedProperties;
            } else if (subscriberId === host) {
              this.users[subscriberId].updateBuffer[sessionId] = updatedProperties;
            }
          }
        }
      }
    }
  }

  pollSubscribers() {
    for (let sessionId in this.sessions) {
      const session = this.sessions[sessionId];
      const sessionUpdateBuffers = {};
  
      // Gather updates for each user in the session
      for (let userId in session.settings.users) {
        const user = this.users[userId];
        if (user && user.updateBuffer[sessionId]) {
          sessionUpdateBuffers[userId] = user.updateBuffer[sessionId];
        }
      }
  
      // Broadcast updates to each user in the session
      for (let userId in session.settings.users) {
        const user = this.users[userId];
        if (user) {
          console.log(`Broadcasting updates to ${userId} in session ${sessionId}`, sessionUpdateBuffers); // Add this line for debugging
          user.send({ route: 'sendDataToSubscriber', args: [sessionId, sessionUpdateBuffers] });
        }
      }
  
      // Clear update buffers for all users in the session
      for (let userId in session.settings.users) {
        const user = this.users[userId];
        if (user) {
          delete user.updateBuffer[sessionId];
        }
      }
    }
  }
  


  sendDataToSubscriber(subscriberId, sessionId, data) {
    const session = this.sessions[sessionId];
    const user = this.users[subscriberId];

    if (!session || !user) return;

    if (user.sessionSubs[sessionId] && user.sessionSubs[sessionId].onmessage) {
      user.sessionSubs[sessionId].onmessage(session, data, user);
    }
  }

  getUserCurrentState(userId) {
    const currentState = this.stateBuffer[userId] || null;
    return currentState;
  }

  closeSession(sessionId, isRemote = false) {
    if (isRemote) {
      this.sendToRemote(sessionId, { route: 'closeSession', args: [sessionId] });
      return;
    }
    const session = this.sessions[sessionId];
    if (session) {
      for (let userId in session.settings.users) {
        this.localUnsubscribe(userId, sessionId);
      }
      delete this.sessions[sessionId];
    }
  }

  sendToRemote(userId, message) {
    if (this.users[userId] && this.users[userId].send) {
      this.users[userId].send(message);
    }
  }
}
