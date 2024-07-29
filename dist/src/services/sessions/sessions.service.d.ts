import { Service, ServiceOptions } from "graphscript-core/index";
import { User } from "../router/Router";
/**
 * Sessions are a way to run a loop that monitors data structures to know procedurally when and what to update
 *
 * StreamSession: source sends props to listener, define listener, source default is creating user
 * SharedSession: two modes:
 *  Hosted: Host receives props from all users based on sessionUserProps, while users receive hostprops
 *  Shared: All users receive the same props based on their own updates
 *
 * There's also these older stream API functions that are more pure for monitoring objects/arrays and updating new data e.g. out of a buffer.
 * Need to esplain/demo all that too.... @@__@@
 */
export type StreamSessionProps = {
    _id?: string;
    settings?: {
        listener: string;
        source: string;
        sessionUserProps: {
            [key: string]: boolean;
        };
        inputBuffers?: {
            [key: string]: boolean;
        };
        admins?: {
            [key: string]: boolean;
        };
        moderators?: {
            [key: string]: boolean;
        };
        password?: string;
        ownerId?: string;
        onopen?: (session: StreamSessionProps) => void;
        onhasupdate?: (session: StreamSessionProps, updated: any) => void;
        onmessage?: (session: StreamSessionProps, updated: any) => void;
        onclose?: (session: StreamSessionProps) => void;
        [key: string]: any;
    };
    data?: {
        [key: string]: any;
    };
    lastTransmit?: string | number;
    [key: string]: any;
};
export type SessionUser = {
    _id: string;
    sessions: {
        [key: string]: any;
    };
    sessionSubs: {
        [key: string]: {
            onopenSub?: number;
            onmessage?: (session: SharedSessionProps, update: any, user: SessionUser) => void;
            onopen?: (session: SharedSessionProps, user: SessionUser) => void;
            onclose?: (session: SharedSessionProps, user: SessionUser) => void;
        };
    };
    inputBuffers?: {
        [key: string]: boolean;
    };
    [props: string]: any;
} & User;
export type SharedSessionProps = {
    _id?: string;
    settings?: {
        name: string;
        sessionUserProps: {
            [key: string]: boolean;
        };
        inputBuffers?: {
            [key: string]: boolean;
        };
        users?: {
            [key: string]: boolean;
        };
        maxUsers?: number;
        host?: string;
        sessionHostProps?: {
            [key: string]: boolean;
        };
        inheritHostData?: boolean;
        admins?: {
            [key: string]: boolean;
        };
        moderators?: {
            [key: string]: boolean;
        };
        spectators?: {
            [key: string]: boolean;
        };
        banned?: {
            [key: string]: boolean;
        };
        password?: string;
        ownerId?: string;
        onhasupdate?: (session: SharedSessionProps, updated: any) => void;
        onopen?: (session: SharedSessionProps) => void;
        onmessage?: (session: SharedSessionProps, updated: any) => void;
        onclose?: (session: SharedSessionProps) => void;
        [key: string]: any;
    };
    data?: {
        shared: {
            [key: string]: {
                [key: string]: any;
            };
        };
        host?: {
            [key: string]: any;
        };
        [key: string]: any;
    };
    lastTransmit?: string | number;
    [key: string]: any;
};
export declare class SessionsService extends Service {
    name: string;
    users: {
        [key: string]: SessionUser;
    };
    sessions: {
        stream: {
            [key: string]: StreamSessionProps;
        };
        shared: {
            [key: string]: SharedSessionProps;
        };
    };
    invites: {
        [key: string]: {
            [key: string]: {
                session: StreamSessionProps | SharedSessionProps | string;
                endpoint?: string;
            };
        };
    };
    constructor(options?: ServiceOptions, users?: {
        [key: string]: SessionUser;
    });
    getStreams: (userId: string, sessionId?: string, password?: string, getData?: boolean) => {};
    getSessionInfo: (userId?: string, sessionIdOrName?: string, password?: string, getData?: boolean) => {};
    createSessionUser: (_id?: string, props?: {}) => SessionUser;
    openStreamSession: (options?: StreamSessionProps, sourceUserId?: string, listenerUserId?: string, newSession?: boolean) => any;
    openSharedSession: (options: SharedSessionProps, userId?: string, newSession?: boolean) => any;
    open: (options: any, userId?: string, listenerId?: string) => any;
    updateSession: (options: StreamSessionProps | SharedSessionProps, userId?: string) => any;
    joinSession: (sessionId: string, userId: string, sessionOptions?: SharedSessionProps | StreamSessionProps, remoteUser?: boolean) => SharedSessionProps | StreamSessionProps | false;
    inviteToSession: (session: StreamSessionProps | SharedSessionProps | string, userIdInvited: string, inviteEndpoint?: string, remoteUser?: boolean) => void;
    receiveSessionInvite: (session: StreamSessionProps | SharedSessionProps | string, userIdInvited: string, endpoint?: string) => string;
    acceptInvite: (session: StreamSessionProps | SharedSessionProps | string, userIdInvited: string, remoteUser?: boolean) => Promise<SharedSessionProps | StreamSessionProps | false>;
    rejectInvite: (session: StreamSessionProps | SharedSessionProps | string, userIdInvited: string, remoteUser?: boolean) => boolean;
    leaveSession: (session: StreamSessionProps | SharedSessionProps | string, userId: string, clear?: boolean, remoteUser?: boolean) => boolean;
    deleteSession: (session: string | StreamSessionProps | SharedSessionProps, userId: string, remoteUsers?: boolean) => boolean;
    getFirstMatch(obj1: {
        [key: string]: any;
    }, obj2: {
        [key: string]: any;
    }): string | false;
    swapHost: (session: StreamSessionProps | SharedSessionProps | string, newHostId?: string, adoptData?: boolean, remoteUser?: boolean) => boolean;
    subscribeToSession: (session: SharedSessionProps | StreamSessionProps | string, userId: string, onmessage?: (session: SharedSessionProps | StreamSessionProps, update: any, user: SessionUser) => void, onopen?: (session: SharedSessionProps | StreamSessionProps, user: SessionUser) => void, onclose?: (session: SharedSessionProps | StreamSessionProps, user: SessionUser) => void) => StreamSessionProps | SharedSessionProps;
    unsubsribeFromSession: (session: SharedSessionProps | StreamSessionProps | string, userId?: string, clear?: boolean) => any;
    processStreamSession: (session: StreamSessionProps, updateObj: any, inputBuffers: any) => any;
    processSharedSession: (session: SharedSessionProps, updateObj: any, inputBuffers: any) => any;
    getStreamSessionUpdates: (sessionHasUpdate?: (session: StreamSessionProps, update: {
        stream?: any;
    }) => void) => {
        streamUpdates: any;
        inputBuffers: {};
    };
    getSharedSessionUpdates: (sessionHasUpdate?: (session: SharedSessionProps, update: {
        shared?: any;
    }) => void) => {
        sharedUpdates: any;
        inputBuffers: {};
    };
    userUpdates: {
        [key: string]: any;
    };
    sessionUpdateCheck: (sessionHasUpdate?: (session: StreamSessionProps | SharedSessionProps, update: {
        shared?: any;
        stream?: any;
    }) => void, transmit?: boolean) => any;
    applyUserUpdates: () => void;
    transmitSessionUpdates: (updates: {
        stream: {
            [key: string]: any;
        };
        shared: {
            [key: string]: any;
        };
    }, clearBuffers: {
        [key: string]: boolean;
    }) => {};
    userUpdateCheck: (user: SessionUser | string, onupdate?: (user: SessionUser, updateObj: {
        [key: string]: any;
    }) => void) => {
        data: {};
    };
    receiveSessionUpdates: (forUserId: any, update: {
        stream: {
            [key: string]: any;
        };
        shared: {
            [key: string]: any;
        };
    } | string) => false | SessionUser;
    getUserSessionData: (user: SessionUser, sessionNameOrId: string) => any;
    getUpdatedUserData: (user: SessionUser) => {
        data: {};
    };
    setUserProps: (user: string | SessionUser, props: {
        [key: string]: any;
    } | string) => boolean;
    bufferInputs: (user: string | SessionUser, inputBuffers: {
        [key: string]: any;
    }) => boolean;
    userUpdateLoop: {
        __operator: (user: SessionUser | string, onupdate?: (user: SessionUser, updateObj: {
            [key: string]: any;
        }) => void) => {
            data: {};
        };
        __node: {
            loop: number;
        };
    };
    sessionLoop: {
        __operator: (sessionHasUpdate?: (session: StreamSessionProps | SharedSessionProps, update: {
            shared?: any;
            stream?: any;
        }) => void, transmit?: boolean) => any;
        __node: {
            loop: number;
        };
    };
}
