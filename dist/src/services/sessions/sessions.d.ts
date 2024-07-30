export declare class InputBuffer {
    private _raw;
    constructor(values?: any[]);
    get buffer(): any[];
    set buffer(inputArray: any[]);
    clear(): void;
    push(...input: any): void;
    get length(): number;
    set length(length: number);
}
export declare class CircularBuffer {
    private _raw;
    private _size;
    onfilled?: () => void;
    _count: number;
    constructor(size: number, values?: any[]);
    get buffer(): any[];
    clear(): void;
    set buffer(inputArray: any[]);
    push(...input: any): void;
    private pushArray;
    get length(): number;
    set length(length: number);
}
export type DelayedGetterRules = {
    [key: string]: ('state' | true) | 'inpbuf' | {
        type: 'circbuf';
        length: number;
    };
};
export declare class DelayBuffer {
    private _buffer;
    _rules: DelayedGetterRules;
    private _pollInterval?;
    private _pollTimeout?;
    onupdate?: (buffer: {
        [key: string]: any;
    }) => void;
    constructor(rules: DelayedGetterRules, poll?: number);
    setRules(rules: DelayedGetterRules): void;
    clearRules(rules: string[]): void;
    set buffer(inputs: {
        [key: string]: any;
    });
    get buffer(): {
        [key: string]: any;
    };
    clear(): void;
    startPolling(): void;
    stopPolling(): void;
}
export declare class DelayBufferManager {
    private buffers;
    private pollInterval;
    private pollTimeout?;
    onupdate?: (aggregatedBuffer: {
        [key: string]: any;
    }) => void;
    constructor(pollInterval: number);
    createBuffer(name: string, rules: DelayedGetterRules, individualPollInterval?: number): void;
    deleteBuffer(name: string): void;
    get(name: string): DelayBuffer | undefined;
    updateBuffer(name: string, updates: {
        [key: string]: any;
    }): void;
    private aggregateBuffers;
    startPolling(): void;
    stopPolling(): void;
}
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
