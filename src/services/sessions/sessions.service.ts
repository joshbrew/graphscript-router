import { Service, ServiceOptions } from "graphscript-core";
import { User } from "../router/Router";
import { SessionManager } from "./sessions";


export class SessionService extends Service {
    users:{[key:string]:User};
    tokens:{[key:string]:string}; //user specific tokens
    sessionManager:SessionManager;
    sessionData:{[key:string]:any} = {};
    constructor(options:ServiceOptions, globalPollInterval) {
        super(options);
        this.sessionManager = new SessionManager(
            globalPollInterval, 
            (aggregatedBuffer, sessionsUpdated) => {
                const split = this.sessionManager.splitUpdatesByUser(aggregatedBuffer);

                for(const uid in split) {
                    if(this.users[uid]) {
                        this.users[uid].send({route:'receiveSessionData', args:[split[uid]]})
                    } else {
                        for(const key in split[uid]) {
                            delete sessionsUpdated[key].users[uid]; //removed from session if inactive
                        }
                    }
                }
            }
        );

        this.load(this.sessionManager); //load the methods on the session manager so we can use it
        //TODO: INTEGRATE USER TOKENS TO WRAP SESSION MANAGER CALLS AS CUSTOM ROUTES INSTEAD
        //e.g. for(const key in this.sessionManager) { 
        //  let callback = (token, ...args) => {
        //   //verify token, then pass user messages normally to the session manager callbacks  
        //}  
        //}
    }

    //we will need this to verify users on their endpoints
    setToken = (userId, token) => {
        this.tokens[userId] = token;
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


}


