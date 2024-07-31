import { Service, ServiceOptions } from "graphscript-core";
import { User } from "../router/Router";
import { SessionManager, SessionRules } from "./sessions";
import { DelayedGetterRules } from "./buffers";



export class SessionService extends Service {
    users: { [key: string]: Partial<User> } = {}; // if we add this as a service to the router it should set users automatically
    sessionManager: SessionManager;
    sessionData: { [key: string]: any } = {}; // current state from the session
    onlocalupdate?: (
        userUpdate: { [sessionId: string]: any },
        sessionsUpdated: { [sessionId: string]: any },
        user: Partial<User>
    ) => void;

    onremoteupdate?: (
        userUpdate: { [sessionId: string]: any },
        user: Partial<User>
    ) => void;

    constructor(
        options?: ServiceOptions,
        globalPollInterval?: number,
        onlocalupdate?: (userUpdate: { [sessionId: string]: any }, sessionsUpdated: { [sessionId: string]: any }, user: Partial<User>) => void,
        users?: { [key: string]: Partial<User> },
        useTokens=false
    ) {
        super(options);
        if (users) {
            this.users = users;
            for (const key in users) { if (!users[key]._id) users[key]._id = key; }
        }
        if (onlocalupdate) this.onlocalupdate = onlocalupdate;
        this.sessionManager = new SessionManager(
            globalPollInterval || 1000,
            (aggregatedBuffer, sessionsUpdated) => {
                const split = this.sessionManager.splitUpdatesByUser(aggregatedBuffer);

                for (const uid in split) {
                    if (this.onlocalupdate) this.onlocalupdate(split[uid], sessionsUpdated, this.users[uid]);
                    else  // default we will use the send handler
                        if (this.users[uid]?.send) {
                            this.users[uid].send({
                                route: 'receiveSessionData', args: [split[uid], uid]
                            }); // send session updates to specific users
                        }
                }
            },
            useTokens // Assuming we want to use tokens by default
        );

        let routes = {};
        const keys = Object.getOwnPropertyNames(this.sessionManager);
        for (const key of keys) {
            if ((key !== 'createSession' && key !== 'updateSessions' && key !== 'updateBuffer' && key !== 'setSessionToken' && key !== 'generateSessionToken' && key !== 'startPolling' && key !== 'stopPolling') && typeof this.sessionManager[key] === 'function') {
                routes[key] = (...args) => {
                    let res = this.sessionManager[key](...args);
                    if (res instanceof Error) console.error(res);
                }
            }
        }

        this.load(this);
        this.load(routes);
    }

    get prevState() {
        if (this.sessionManager?.prevState)
            return this.sessionManager.prevState;
    }

    // we will need this to verify users on their endpoints
    setSessionToken = (userId: string, token: string, remote?: boolean) => {
        this.sessionManager.setSessionToken(userId, token);
        if (remote && this.users[userId]?.send) {
            const message = { route: 'setSessionToken', args: [userId, token] };
            this.users[userId].send(message);
        } else {
            if (!this.users[userId]) this.users[userId] = { _id: userId };
            this.users[userId].token = token;
        }
    }

    generateSessionToken = (userId?: string) => {
        const token = this.sessionManager.generateSessionToken(userId);
        if (userId && this.users[userId]) {
            if (!this.users[userId]) this.users[userId] = { _id: userId };
            this.users[userId].token = token;
        }
        return token;
    }

    // remote session communication via User conventions 
    messageRemoteSession = (userId: string, route: string, ...args: any[]) => {
        let user = this.users[userId];
        user.send({ route, args })
    }

    // subscribe to this
    receiveSessionData = (data: { [key: string]: any }, userId: string) => {
        let updatedSessions = {};
        for (const key in data) {
            if (!this.sessionData[key]) this.sessionData[key] = {};
            this.recursivelyAssign(this.sessionData[key] || {}, data);
            updatedSessions = this.sessionData[key];
        }
        if (this.onremoteupdate) {
            this.onremoteupdate(updatedSessions, this.users[userId]);
        }
        return updatedSessions;
    }

    createSession = (sessionId: string, userId: string, delayBufferRules: DelayedGetterRules, sessionRules?: Partial<SessionRules>, userToken?: string) => {
        return this.sessionManager.createSession(sessionId, userId, delayBufferRules, sessionRules, userToken)
    }

    updateSessions = (updates: { [key: string]: any; }, userId?: string, userToken?: string, passwords?: {[key:string]:string}, adminId?: string, adminToken?: string) => {
        return this.sessionManager.updateSessions(updates, userId, userToken, passwords, adminId, adminToken);
    }

    updateBuffer = (sessionId: string, updates: { [key: string]: any; }, userId?: string, userToken?: string, password?: string, adminId?: string, adminToken?: string) => {
        return this.sessionManager.updateBuffer(sessionId, updates, userId, userToken, password, adminId, adminToken);
    }

    startPolling = () => {
        return this.sessionManager.startPolling();
    }

    stopPolling = () => {
        return this.sessionManager.stopPolling();
    }
}