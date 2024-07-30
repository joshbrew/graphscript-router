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
    createSession(sessionId: string, creatorId: string, delayBufferRules: DelayedGetterRules, sessionRules?: Partial<SessionRules>): void;
    deleteSession(sessionId: string, adminId: string): void;
    getSessionInfo(sessionId: string): {
        _id: string;
        users: string[];
        dbrules: DelayedGetterRules;
    };
    private checkAdmin;
    updateBuffer: (sessionId: string, updates: {
        [key: string]: any;
    }, userId?: string, password?: string, admin?: string) => void;
    addUserToSession(sessionId: string, userId: string, password?: string, admin?: string, dbrules?: DelayedGetterRules): void;
    removeUserFromSession(sessionId: string, userId: string, adminId: string): void;
    setAdmin(sessionId: string, adminId: string, userId: string): void;
    removeAdmin(sessionId: string, adminId: string, userId: string): void;
    banUser(sessionId: string, adminId: string, userId: string): void;
    unbanUser(sessionId: string, adminId: string, userId: string): void;
    splitUpdatesByUser(aggregatedBuffers: {
        [key: string]: any;
    }): {
        [userId: string]: {
            [sessionId: string]: any;
        };
    };
    startPolling(): void;
    stopPolling(): void;
}
export {};
