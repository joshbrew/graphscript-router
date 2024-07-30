import { Service, ServiceOptions } from "graphscript-core";
import { User } from "../router/Router";
import { SessionManager } from "./sessions";


export class SessionService extends Service {
    users:{[key:string]:User}; //if we add this as a service to the router it should set users automatically
    tokens:{[key:string]:string}; //user specific tokens
    useTokens = true;
    sessionManager:SessionManager;
    sessionData:{[key:string]:any} = {};
    constructor(
        options:ServiceOptions, 
        globalPollInterval:number, 
        users?:{[key:string]:User}
    ) {
        super(options);
        if(users) this.users = users;
        this.sessionManager = new SessionManager(
            globalPollInterval, 
            (aggregatedBuffer, sessionsUpdated) => {
                const split = this.sessionManager.splitUpdatesByUser(aggregatedBuffer);

                for(const uid in split) {
                    if(this.users[uid]) {
                        this.users[uid].send({
                            route:'receiveSessionData', args:[split[uid]]
                        }); //send session updates to specific users
                    } else {
                        for(const key in split[uid]) {
                            delete sessionsUpdated[key].users[uid]; //removed from session if inactive
                        }
                    }
                }
            }
        );

        let routes = {};
        for(const key in this.sessionManager) {
            if(typeof this.sessionManager[key] === 'function') {
                routes[key] = (userId, token, ...args) => { //lead all sessionManager calls with userId and token then supply the normal arguments
                    if(this.users[userId] && this.tokens[userId] && this.tokens[userId] === token) {
                        return this.sessionManager[key](...args); //validate user activity with tokens
                    } else throw new Error("User needs to be registered with a token");
                }
            }
        }

        this.load(routes);

    }

    //we will need this to verify users on their endpoints
    setSessionToken = (userId, token, remote?) => {
        if(remote && this.users[userId])
            this.users[userId].send({route:'setSessionToken', args:[userId, token]})
        else
            this.tokens[userId] = token;
    }

    generateSessionToken = () => {
        return `${Math.floor(Math.random()*1000000000000000)}`;
    }

    //remote session communication via User conventions 
    messageRemoteSession = (userId:string, token:string, route:string, ...args:any[]) => {
        let user = this.users[userId];
        if(route in this.sessionManager) {
            user.send({route, args:[userId, token, ...args]})
        } else user.send({route, args});
    }

    //subscribe to this
    receiveSessionData = (data:{[key:string]:any}) => {
        let updatedSessions = {};
        for(const key in data) {
            if(!this.sessionData[key]) this.sessionData[key] = {};
            this.recursivelyAssign(this.sessionData[key] || {}, data);
            updatedSessions = this.sessionData[key];
        }
        return updatedSessions;
    }

}


