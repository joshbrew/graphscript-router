import { Service, ServiceOptions } from "graphscript-core";
import { User } from "../router/Router";
import { SessionManager, SessionRules } from "./sessions";
import { DelayedGetterRules } from "./buffers";
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
    createSession: (sessionId: string, userId: string, delayBufferRules: DelayedGetterRules, sessionRules?: Partial<SessionRules>, userToken?: string) => Error;
    updateSessions: (updates: {
        [key: string]: any;
    }, userId?: string, userToken?: string, passwords?: {
        [key: string]: string;
    }, adminId?: string, adminToken?: string) => void;
    updateBuffer: (sessionId: string, updates: {
        [key: string]: any;
    }, userId?: string, userToken?: string, password?: string, adminId?: string, adminToken?: string) => void;
    startPolling: () => void;
    stopPolling: () => void;
}
