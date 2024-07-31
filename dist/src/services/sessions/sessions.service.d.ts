import { Service, ServiceOptions } from "graphscript-core";
import { User } from "../router/Router";
import { SessionManager } from "./sessions";
export declare class SessionService extends Service {
    users: {
        [key: string]: Partial<User>;
    };
    sessionManager: SessionManager;
    sessionData: {
        [key: string]: any;
    };
    onlocalupdate?: (userUpdate: {
        [sessionId: string]: any;
    }, sessionsUpdated: {
        [sessionId: string]: any;
    }, user: Partial<User>) => void;
    onremoteupdate?: (userUpdate: {
        [sessionId: string]: any;
    }, user: Partial<User>) => void;
    constructor(options?: ServiceOptions, globalPollInterval?: number, onlocalupdate?: (userUpdate: {
        [sessionId: string]: any;
    }, sessionsUpdated: {
        [sessionId: string]: any;
    }, user: Partial<User>) => void, users?: {
        [key: string]: Partial<User>;
    }, useTokens?: boolean);
    get prevState(): {
        [sessionId: string]: {
            [updatedProp: string]: any;
        };
    };
    setSessionToken: (userId: string, token: string, remote?: boolean) => void;
    generateSessionToken: (userId?: string) => string;
    messageRemoteSession: (userId: string, route: string, ...args: any[]) => void;
    receiveSessionData: (data: {
        [key: string]: any;
    }, userId: string) => {};
    startPolling: () => void;
    stopPolling: () => void;
}
