import { Service, ServiceOptions } from "graphscript-core";
import { User } from "../router/Router";
import { SessionManager } from "./sessions";


export class SessionService extends Service {
    users:{[key:string]:User}; //if we add this as a service to the router it should set users automatically
    tokens:{[key:string]:string}; //user specific tokens
    useTokens = true;
    sessionManager:SessionManager;
    sessionData:{[key:string]:any} = {};
    constructor(options:ServiceOptions, globalPollInterval:number, users?:{[key:string]:User}) {
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
                routes[key] = (userId, token, ...args) => {
                    if(this.users[userId] && this.tokens[userId] && this.tokens[userId] === token) {
                        return this.sessionManager[key](...args); //validate user activity with tokens
                    } else throw new Error("User needs to be registered with a token");
                }
            }
        }

        this.load(routes);

    }

    generateToken = () => {
        return `${Math.floor(Math.random()*1000000000000000)}`;
    }

    receiveSessionData = (data:{[key:string]:any}) => {
        let updatedSessions = {};
        for(const key in data) {
            if(!this.sessionData[key]) this.sessionData[key] = {};
            this.recursivelyAssign(this.sessionData[key] || {}, data);
            updatedSessions = this.sessionData[key];
        }
        return updatedSessions;
    }

    //we will need this to verify users on their endpoints
    setToken = (userId, token, remote?) => {
        if(remote && this.users[userId])
            this.users[userId].send({route:'setToken', args:[userId, token]})
        else
            this.tokens[userId] = token;
    }

}


