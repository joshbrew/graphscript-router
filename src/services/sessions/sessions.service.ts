import { Service, ServiceOptions } from "graphscript-core";
import { User } from "../router/Router";
import { SessionManager } from "./sessions";


export class SessionService extends Service {

    users: { [key: string]: Partial<User> } = {}; //if we add this as a service to the router it should set users automatically
    tokens: { [key: string]: string } = {}; //user specific tokens
    useTokens = true;
    sessionManager: SessionManager;
    sessionData: { [key: string]: any } = {}; //current state from the session
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
        users?: { [key: string]: Partial<User> }
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
                    else  //default we will use the send handler
                        if (this.users[uid]?.send) {
                            this.users[uid].send({
                                route: 'receiveSessionData', args: [split[uid], uid]
                            }); //send session updates to specific users
                        } //else {
                    //     for(const key in split[uid]) {
                    //         delete sessionsUpdated[key].users[uid]; //removed from session if inactive
                    //     }
                    // }
                }

            }
        );

        let routes = {};
        const keys = Object.getOwnPropertyNames(this.sessionManager);
        for (const key of keys) {
            if (typeof this.sessionManager[key] === 'function') {
                routes[key] = (userId, token, ...args) => { //lead all sessionManager calls with userId and token then supply the normal arguments
                    ///console.log(key,userId, token, args, this.users)
                    if (this.users[userId] && (!this.useTokens || (this.tokens[userId] && this.tokens[userId] === token))) {
                        return this.sessionManager[key](...args); //validate user activity with tokens
                    } else throw new Error("User needs to be registered with a token");
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

    //we will need this to verify users on their endpoints
    setSessionToken = (userId, token, remote?) => {
        if (remote && this.users[userId]?.send) {
            const message = { route: 'setSessionToken', args: [userId, token] };
            this.users[userId].send(message);
        } else {
            if (!this.users[userId]) this.users[userId] = {};
            this.tokens[userId] = token;
            this.users[userId].token = token;
        }
    }

    generateSessionToken = (userId?) => {
        const t = `${Math.floor(Math.random() * 1000000000000000)}`;
        if (userId) {
            if (!this.users[userId]) this.users[userId] = { _id: userId };
            this.tokens[userId] = t; //set locally too
            this.users[userId].token = t;
        }
        return t;
    }

    //remote session communication via User conventions 
    messageRemoteSession = (userId: string, token: string, route: string, ...args: any[]) => {
        let user = this.users[userId];
        if (typeof this.sessionManager[route] === 'function') {
            user.send({ route, args: [userId, token, ...args] })
        } else user.send({ route, args });
    }

    //subscribe to this
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

}


