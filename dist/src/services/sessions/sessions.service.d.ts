import { Service, ServiceOptions } from "graphscript-core";
import { User } from "../router/Router";
import { SessionManager } from "./sessions";
export declare class SessionService extends Service {
    users: {
        [key: string]: User;
    };
    tokens: {
        [key: string]: string;
    };
    sessionManager: SessionManager;
    sessionData: {
        [key: string]: any;
    };
    constructor(options: ServiceOptions, globalPollInterval: any);
    setToken: (userId: any, token: any) => void;
    receiveSessionData: (data: {
        [key: string]: any;
    }) => {};
}
