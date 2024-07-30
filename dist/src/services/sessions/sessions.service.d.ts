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
    useTokens: boolean;
    sessionManager: SessionManager;
    sessionData: {
        [key: string]: any;
    };
    constructor(options: ServiceOptions, globalPollInterval: number, users?: {
        [key: string]: User;
    });
    setSessionToken: (userId: any, token: any, remote?: any) => void;
    generateSessionToken: () => string;
    messageRemoteSession: (userId: any, token: any, route: any, ...args: any[]) => void;
    receiveSessionData: (data: {
        [key: string]: any;
    }) => {};
}
