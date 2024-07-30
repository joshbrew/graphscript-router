export class InputBuffer {
    private _raw: any[] = [];
  
    constructor(values?: any[]) {
      if (values) this._raw = [...values];
    }
  
    get buffer() {
      const currentBuffer = this._raw;
      this._raw = [];
      return currentBuffer;
    }
  
    set buffer(inputArray) {
      if (Array.isArray(inputArray)) {
        this._raw.push(...inputArray);
      } else {
        throw new Error("Input must be an array");
      }
    }

    clear() {
        this._raw.length = 0;
    }
  
    push(...input: any) {
        if(input.length > 1)
            this._raw.push(...input);
        else if(Array.isArray(input[0])) this._raw.push(...input[0]);
        else this._raw.push(input[0]);
    }
  
    get length() {
      return this._raw.length;
    }
  
    set length(length: number) {
      this._raw.length = length;
    }
}
  
export class CircularBuffer {
    private _raw: any[];
    private _size: number;
    public onfilled?: () => void;
    _count=0;
  
    constructor(size: number, values?: any[]) {
      if (size <= 0) {
        throw new Error("Size must be greater than 0");
      }
  
      this._size = size;
      this._raw = new Array(size);
  
      if (values) {
        this.push(values);
      }
    }
  
    get buffer() {
      if(this._count < this._size) return this._raw.slice(this._size - this._count); //get only the used part of the buffer
      return [...this._raw];
    }

    clear() {
        this._raw.length = 0;
    }
  
    set buffer(inputArray: any[]) {
      this.push(inputArray);
    }
  
    push(...input: any) {
      if(input.length > 1) {
        this.pushArray(input);
      } else if (Array.isArray(input[0])) {
        this.pushArray(input[0]);
      } else {
        if (this._raw.length >= this._size) {
          this._raw.splice(0,1);
        }
        this._raw.push(input[0]);
  
        if (this._raw.length === this._size && this.onfilled) {
          this.onfilled();
        }
        else if(this._count < this._size) this._count++;
      }
    }
  
    private pushArray(inputs: any[]) {
      const newEntriesLength = inputs.length;
      const totalLength = this._raw.length + newEntriesLength;
  
      if (totalLength > this._size) {
        this._raw.splice(0, totalLength - this._size);
      }
      this._raw.push(...inputs);
      if (this._raw.length === this._size && this.onfilled) {
        this.onfilled(); 
      } else if(this._count < this._size) {
        this._count += inputs.length; if(this._count > this._size) this._count = this._size;
      }
    }
  
  
    get length() {
      return this._count;
    }
  
    set length(length: number) {
      if (length < 0 || length > this._size) {
        throw new Error(`Length must be between 0 and ${this._size}`);
      }
      this._count = length;
    }
}
  
export type DelayedGetterRules = { [key: string]: ( 'state' | true ) | 'inpbuf' | { type: 'circbuf', length: number } };

export class DelayBuffer {
    private _buffer: { [key: string]: any } = {};
    _rules: DelayedGetterRules;
    private _pollInterval?: number;
    private _pollTimeout?: any;
    public onupdate?: (buffer: { [key: string]: any }) => void;
  
    constructor(
        rules: DelayedGetterRules,
        poll?: number // milliseconds
    ) {
      this._pollInterval = poll;
  
      this.setRules(rules);
    }

    setRules(rules:DelayedGetterRules) { //additional watch keys, DB will only track these values, not all you supply
        if(this._rules) Object.assign(this._rules, rules);
        else this._rules = rules;
    }

    clearRules(rules:string[]) {
        for(const key of rules) delete this._rules[key];
    }
  
    set buffer(inputs: { [key: string]: any }) {
      for (const key in inputs) {
        const rule = this._rules[key];
        if(!rule) continue;
        const inputValue = inputs[key];
  
        if (rule === 'state' || rule === true) {
          this._buffer[key] = inputValue;
        } else if (rule === 'inpbuf') {
          if (!this._buffer[key]) {
            this._buffer[key] = new InputBuffer();
          }
          this._buffer[key].push(inputValue);
        } else if (rule?.type === 'circbuf') {
          if (!this._buffer[key]) {
            this._buffer[key] = new CircularBuffer(rule.length);
          }
          this._buffer[key].push(inputValue);
        }
      }
    }
  
    get buffer() {
      const currentBuffer: { [key: string]: any } = {};
      for (const key in this._buffer) {
        if(this._buffer[key] === undefined) continue;
        if (this._buffer[key]?._raw) {
          currentBuffer[key] = this._buffer[key].buffer; 
          this._buffer[key].clear();;
        } else {
          currentBuffer[key] = this._buffer[key];
          delete this._buffer[key];
        }
      }
      return currentBuffer;
    }

    clear() {
        this._buffer = {};
    }
  
    startPolling() {
      if (this._pollInterval && !this._pollTimeout) {
        this._pollTimeout = setInterval(() => {
          if (Object.keys(this._buffer).length > 0 && this.onupdate) {
            this.onupdate(this.buffer);
            this.clear(); //clear after polling
          }
        }, this._pollInterval);
      }
    }
  
    stopPolling() {
      if (this._pollTimeout) {
        clearInterval(this._pollTimeout);
        this._pollTimeout = undefined;
      }
    }
}
  



export class DelayBufferManager {
    private buffers: { [key: string]: DelayBuffer } = {};
    private pollInterval: number;
    private pollTimeout?: any;
    public onupdate?: (aggregatedBuffer: { [key: string]: any }) => void;
  
    constructor(pollInterval: number) {
      this.pollInterval = pollInterval;
    }
  
    createBuffer(name: string, rules: DelayedGetterRules, individualPollInterval?: number) {
      if (this.buffers[name]) {
        throw new Error(`Buffer with name ${name} already exists`);
      }
      const buffer = new DelayBuffer(rules, individualPollInterval);
      this.buffers[name] = buffer;
    }

    deleteBuffer(name:string) {
        delete this.buffers[name];
    }
  
    get(name: string): DelayBuffer | undefined {
      return this.buffers[name];
    }

    updateBuffer(name:string, updates:{[key:string]:any}) {
        if(this.buffers[name]) 
            this.buffers[name].buffer = updates; //will load this into the delaybuffer
        else throw new Error("No buffer found of name " + name);
    }
  
    private aggregateBuffers() {
      const aggregatedBuffer: { [key: string]: any } = {};
      for (const key in this.buffers) {
        const bufferData = this.buffers[key].buffer;
        if (Object.keys(bufferData).length > 0) {
          aggregatedBuffer[key] = bufferData;
          this.buffers[key].clear();
        }
      }
      if (this.onupdate && Object.keys(aggregatedBuffer).length > 0) {
        this.onupdate(aggregatedBuffer);
      }
    }
  
    startPolling() {
      if (this.pollInterval && !this.pollTimeout) {
        this.pollTimeout = setInterval(() => {
          this.aggregateBuffers();
        }, this.pollInterval);
      }
    }
  
    stopPolling() {
      if (this.pollTimeout) {
        clearInterval(this.pollTimeout);
        this.pollTimeout = undefined;
      }
    }
  }



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
    public onupdate?: (
        aggregatedBuffer: { [key: string]: any }, 
        sessionsUpdated: { [sessionId: string]: Session }
    ) => void;
  
    constructor(
        globalPollInterval: number, 
        onupdate?: (aggregatedBuffer: { [key: string]: any }, sessionsUpdated: { [sessionId: string]: Session }) => void
    ) {
        if(globalPollInterval) this.globalPollInterval = globalPollInterval;
        if(onupdate) this.onupdate = onupdate;
        this.delayBufferManager = new DelayBufferManager(this.globalPollInterval);
        this.delayBufferManager.onupdate = (aggregateBuffers) => {
            if (this.onupdate) {
                let updateKeys = Object.keys(aggregateBuffers);
                let sessionsUpdated: { [sessionId: string]: Session } = {};
                updateKeys.forEach((id) => {
                    sessionsUpdated[id] = this.sessions[id];
                });
                this.onupdate(aggregateBuffers, sessionsUpdated);
            } else {
                console.log("Buffers updated:", aggregateBuffers);
            }
        };
    }
  
    createSession(
        sessionId: string, 
        creatorId: string, 
        delayBufferRules: DelayedGetterRules, 
        sessionRules?: Partial<SessionRules>
    ) {
        if (this.sessions[sessionId]) {
            throw new Error(`Session with ID ${sessionId} already exists`);
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
  
    deleteSession(sessionId: string, adminId: string) {
        const session = this.sessions[sessionId];
        if (!session) {
            throw new Error(`Session with ID ${sessionId} does not exist`);
        }
    
        if(this.checkAdmin(sessionId, adminId) || Object.keys(session.rules.adminUsers).length === 0 || Object.keys(session.users).length === 0) {
            this.delayBufferManager.deleteBuffer(sessionId);
            delete this.sessions[sessionId];
        }
    }

    getSessionInfo(sessionId: string) {
        const session = this.sessions[sessionId];
        if (!session) {
            throw new Error(`Session with ID ${sessionId} does not exist`);
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

    updateBuffer = (
        sessionId: string, 
        updates: { [key: string]: any; }, 
        userId?: string, 
        password?: string, 
        admin?: string
    ) => {
        let session = this.sessions[sessionId];
        if (
            (userId && session.users[userId]) || 
            (admin && session.rules.adminUsers[admin]) || 
            (session.rules.password && session.rules.password === password)
        ) {
            this.delayBufferManager.updateBuffer(sessionId, updates);
        }
    };
  
    addUserToSession(
        sessionId: string, 
        userId: string, 
        password?: string, 
        admin?: string,
        dbrules?: DelayedGetterRules // e.g. add specific keys that the user will be updating
    ) {
        const session = this.sessions[sessionId];
        if (!session) {
            throw new Error(`Session with ID ${sessionId} does not exist`);
        }

        if(session.rules.password && session.rules.password !== password || (admin && session.rules.adminUsers[admin])) {
            throw new Error(`Password required`);
        }
  
        if (session.rules.bannedUsers && session.rules.bannedUsers[userId]) {
            throw new Error(`User ${userId} is banned from this session`);
        }
  
        session.users[userId] = true;
        if(dbrules) {
            session.db.setRules(dbrules);
        }
    }
  
    removeUserFromSession(sessionId: string, userId: string, adminId: string) {
        const session = this.sessions[sessionId];
        if (!session) {
            throw new Error(`Session with ID ${sessionId} does not exist`);
        }
  
        if(session.users[userId] || this.checkAdmin(sessionId, adminId) || Object.keys(session.rules.adminUsers).length === 0) {
            delete session.users[userId];
        }
    }
  
    setAdmin(sessionId: string, adminId: string, userId: string) {
        const session = this.sessions[sessionId];
        if (!session) {
            throw new Error(`Session with ID ${sessionId} does not exist`);
        }
  
        if(this.checkAdmin(sessionId, adminId)) {
            session.rules.adminUsers[userId] = true;
        }
    }
  
    removeAdmin(sessionId: string, adminId: string, userId: string) {
        const session = this.sessions[sessionId];
        if (!session) {
            throw new Error(`Session with ID ${sessionId} does not exist`);
        }
  
        if(Object.keys(session.rules.adminUsers).length > 1 && this.checkAdmin(sessionId, adminId)) {
            delete session.rules.adminUsers[userId];
        }
    }
  
    banUser(sessionId: string, adminId: string, userId: string) {
        const session = this.sessions[sessionId];
        if (!session) {
            throw new Error(`Session with ID ${sessionId} does not exist`);
        }
  
        if(this.checkAdmin(sessionId, adminId)) {
            session.rules.bannedUsers[userId] = true;
            this.removeUserFromSession(sessionId, userId, adminId);
        }
    }
  
    unbanUser(sessionId: string, adminId: string, userId: string) {
        const session = this.sessions[sessionId];
        if (!session) {
            throw new Error(`Session with ID ${sessionId} does not exist`);
        }
  
        if(this.checkAdmin(sessionId, adminId)) {
            delete session.rules.bannedUsers[userId];
        }
    }
  
    splitUpdatesByUser(aggregatedBuffers: { [key: string]: any }) {
        const userUpdates: { [userId: string]: { [sessionId: string]: any } } = {};

        Object.keys(aggregatedBuffers).forEach(sessionId => {
            const session = this.sessions[sessionId];
            if(!session) return;
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

    startPolling() {
        this.delayBufferManager.startPolling();
    }
  
    stopPolling() {
        this.delayBufferManager.stopPolling();
    }
}
  
