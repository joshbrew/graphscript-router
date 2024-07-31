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
    }) => void);
    createSession: (sessionId: string, creatorId: string, delayBufferRules: DelayedGetterRules, sessionRules?: Partial<SessionRules>) => Error;
    deleteSession: (sessionId: string, adminId: string) => Error;
    getSessionInfo: (sessionId: string) => Error | {
        _id: string;
        users: string[];
        dbrules: DelayedGetterRules;
    };
    private checkAdmin;
    updateSessions: (updates: {
        [sessionId: string]: {
            [key: string]: any;
        };
    }, userId?: string, passwords?: {
        [key: string]: string;
    }, admin?: string) => void;
    updateBuffer: (sessionId: string, updates: {
        [key: string]: any;
    }, userId?: string, password?: string, admin?: string) => void;
    addUserToSession: (sessionId: string, userId: string, password?: string, admin?: string, dbrules?: DelayedGetterRules) => Error;
    removeUserFromSession: (sessionId: string, userId: string, adminId: string) => Error;
    setAdmin: (sessionId: string, adminId: string, userId: string) => Error;
    removeAdmin: (sessionId: string, adminId: string, userId: string) => Error;
    banUser: (sessionId: string, adminId: string, userId: string) => Error;
    unbanUser: (sessionId: string, adminId: string, userId: string) => Error;
    splitUpdatesByUser: (aggregatedBuffers: {
        [key: string]: any;
    }) => {
        [userId: string]: {
            [sessionId: string]: any;
        };
    };
    startPolling: () => void;
    stopPolling: () => void;
}
export {};
