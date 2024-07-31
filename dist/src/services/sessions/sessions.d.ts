import { DelayBuffer, DelayedGetterRules } from './buffers';
interface SessionRules {
    password?: string;
    bannedUsers: {
        [userId: string]: boolean;
    };
    adminUsers: {
        [userId: string]: boolean;
    };
}
interface Session {
    users: {
        [userId: string]: boolean;
    };
    rules: SessionRules;
    db: DelayBuffer;
}
export declare class SessionManager {
    private sessions;
    private delayBufferManager;
    private globalPollInterval;
    private tokens;
    private useTokens;
    prevState: {
        [sessionId: string]: {
            [updatedProp: string]: any;
        };
    };
    onupdate?: (aggregatedBuffer: {
        [key: string]: any;
    }, sessionsUpdated: {
        [sessionId: string]: Session;
    }) => void;
    constructor(globalPollInterval: number, onupdate?: (aggregatedBuffer: {
        [key: string]: any;
    }, sessionsUpdated: {
        [sessionId: string]: Session;
    }) => void, useTokens?: boolean);
    createSession: (sessionId: string, creatorId: string, creatorToken: string, delayBufferRules: DelayedGetterRules, sessionRules?: Partial<SessionRules>) => Error;
    deleteSession: (sessionId: string, adminId: string, adminToken: string) => Error;
    getSessionInfo: (sessionId: string, userId: string, userToken: string) => Error | {
        _id: string;
        users: string[];
        dbrules: DelayedGetterRules;
    };
    private checkAdmin;
    updateSessions: (updates: {
        [sessionId: string]: {
            [key: string]: any;
        };
    }, userId?: string, userToken?: string, passwords?: {
        [key: string]: string;
    }, adminId?: string, adminToken?: string) => void;
    updateBuffer: (sessionId: string, updates: {
        [key: string]: any;
    }, userId?: string, userToken?: string, password?: string, adminId?: string, adminToken?: string) => void;
    addUserToSession: (sessionId: string, userId: string, userToken: string, password?: string, dbrules?: DelayedGetterRules, adminId?: string, adminToken?: string) => Error;
    removeUserFromSession: (sessionId: string, userId: string, adminId: string, adminToken: string) => Error;
    setAdmin: (sessionId: string, adminId: string, adminToken: string, userId: string) => Error;
    removeAdmin: (sessionId: string, adminId: string, adminToken: string, userId: string) => Error;
    banUser: (sessionId: string, adminId: string, adminToken: string, userId: string) => Error;
    unbanUser: (sessionId: string, adminId: string, adminToken: string, userId: string) => Error;
    splitUpdatesByUser: (aggregatedBuffers: {
        [key: string]: any;
    }) => {
        [userId: string]: {
            [sessionId: string]: any;
        };
    };
    startPolling: () => void;
    stopPolling: () => void;
    setSessionToken: (userId: string, token: string) => void;
    generateSessionToken: (userId?: string) => string;
}
export {};
