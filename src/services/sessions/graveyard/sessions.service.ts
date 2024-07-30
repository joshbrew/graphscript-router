//@ts-nocheck

import { stringifyFast } from "graphscript-core/index";
import { Service, ServiceOptions } from "graphscript-core/index";
import { loaders } from "graphscript-core/index";

import { User } from "../../router/Router";

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


//parse from this object/endpoint and send to that object/endpoint, e.g. single users
//todo: make this hurt brain less to reconstruct the usage
export type StreamSessionProps = {
    _id?:string,
    settings?:{
        listener:string, //listening user
        source:string, //source user
        sessionUserProps:{[key:string]:boolean}, //data on the source user{} object that we will track and pipe to the listener
        inputBuffers?:{[key:string]:boolean}, //these will clear after every loop so users can push input sequences
        admins?:{[key:string]:boolean}, //session admins 
        moderators?:{[key:string]:boolean}, //session mods, for custom logic
        password?:string,
        ownerId?:string, //session creator
        //general onmessage settings not specific to a user
        onopen?:(session:StreamSessionProps)=>void,
        onhasupdate?:(session:StreamSessionProps, updated:any)=>void, //host-side
        onmessage?:(session:StreamSessionProps, updated:any)=>void, //user-side
        onclose?:(session:StreamSessionProps)=>void,
        [key:string]:any //arbitrary props e.g. settings, passwords
    },
    data?:{
        [key:string]:any
    },
    lastTransmit?:string|number,
    [key:string]:any //arbitrary props for custom logic
}

export type SessionUser = {
    _id:string, //unique identifier for user, used as key in users object and in general
    sessions:{[key:string]:any},
    sessionSubs:{[key:string]:{
        onopenSub?:number,
        onmessage?:(session:SharedSessionProps, update:any, user:SessionUser)=>void, 
        onopen?:(session:SharedSessionProps, user:SessionUser)=>void,
        onclose?:(session:SharedSessionProps, user:SessionUser)=>void
    }},
    inputBuffers?:{[key:string]:boolean}, //which keys on the user are input buffers?
    [props:string]:any
} & User //extend base users on the router or just wrapping a connection from another service

//sessions for shared user data and game/app logic for synchronous and asynchronous sessions to stream selected properties on user objects as they are updated
export type SharedSessionProps = {
    _id?:string,
    settings?:{
        name:string, //name of the session used for lookup (will have a unique id anyway)
        sessionUserProps:{[key:string]:boolean}, //keys on the users that we'll sync on the session
        inputBuffers?:{[key:string]:boolean}, //these will clear after every loop so users can push input sequences
        users?:{[key:string]:boolean}, //current users joined
        maxUsers?:number,
        host?:string, //if there is a host, all users only receive from the host's prop updates and vise versa
        sessionHostProps?:{[key:string]:boolean}, //if host is defined and hostprops defined then we'll used the host data asynchronously so host and users can report data differently
        inheritHostData?:boolean, //new hosts adopt old host data? Default true
        admins?:{[key:string]:boolean}, //session admins
        moderators?:{[key:string]:boolean}, //session mods, for custom logic
        spectators?:{[key:string]:boolean}, //session spectators, will receive updates
        banned?:{[key:string]:boolean}, //blocked users from session
        password?:string,
        ownerId?:string,
        onhasupdate?:(session:SharedSessionProps, updated:any)=>void, //host-side
        onopen?:(session:SharedSessionProps)=>void,
        onmessage?:(session:SharedSessionProps, updated:any)=>void,
        onclose?:(session:SharedSessionProps)=>void,
        [key:string]:any //arbitrary props e.g. settings, passwords
    },
    data?:{
        shared:{ //if no host, this contains all users, if host is set, this contains only the host user's data which we use for asynchronous communication 
            [key:string]:{
                [key:string]:any
            }
        },
        host?:{ //if a session defines a host, then this will hold user data sent to host, and shared will hold host data sent to users
            [key:string]:any
        },
        [key:string]:any
    },
    lastTransmit?:string|number,
    [key:string]:any //arbitrary props e.g. settings, passwords
}


//Todo: streamline, we don't *really* need 3 types of streaming data structures but on the other hand everything is sort of optimized so just keep it
export class SessionsService extends Service {

    name='sessions';

    users:{ [key:string]:SessionUser } = {}

    //complex user sessions with some premade rulesets
    sessions:{
        stream:{[key:string]:StreamSessionProps}, //sync user props <--> user props
        shared:{[key:string]:SharedSessionProps}//sync user props <--> all other users props
    } = {
        stream:{},
        shared:{}
    }

    invites:{
        [key:string]:{ //userId
            [key:string]:{//session Id
                session:StreamSessionProps|SharedSessionProps|string, 
                endpoint?:string //userid to send joinSession call to
            } //session options
        }
    } = {}


    constructor(options?:ServiceOptions, users?:{[key:string]:SessionUser}) {
        super(options);
        this.setLoaders(loaders);
        this.load(this);
        if(users) this.users = users;
    }

    getStreams = (
        userId:string,
        sessionId?:string,//if unspecified return full list associated with the user
        password?:string,
        getData?:boolean
    ) => {
        
        const getStream = (sessionId) => {
            let s = this.sessions.stream[sessionId];
            if(s && s.settings) {
                if(
                    s.settings.source === userId || 
                    s.settings.listener === userId || 
                    s.settings.ownerId === userId || 
                    s.settings.admins?.[userId as string] || 
                    s.settings.moderators?.[userId as string]
                ) {
                    if(s.settings.password && password !== s.settings.password) return undefined;
                    const res = {...(getData ? (s.data ? s.data : {}) : s.settings)};
                    delete res.password;
                    return res;
                }
            }
        }

        if(sessionId) {
            if(this.sessions.stream[sessionId]) {
                return getStream(sessionId);
            }
        } else {
            let res = {};
            for(const id in this.sessions.stream) {
                let s = this.sessions.stream[id];
                let r = getStream(id);
                if(r) res[id] = r;
            }
            if(Object.keys(res).length > 0) 
                return res;
        }
    }

    getSessionInfo = (
        userId?:string,
        sessionIdOrName?:string, //id or name (on shared sessions)
        password?:string,
        getData?:boolean //get data instead of settings?
    ) => {
        if(this.sessions.stream[sessionIdOrName]) {
            let s = this.sessions.stream[sessionIdOrName];
            if(s.settings) {
                if(
                    s.settings.source === userId || 
                    s.settings.listener === userId || 
                    s.settings.ownerId === userId || 
                    s.settings.admins?.[userId] || 
                    s.settings.moderators?.[userId]
                ) {
                    if(s.settings.password && password !== s.settings.password) return undefined;
                    const res = {...(getData ? (s.data ? s.data : {}) : s.settings)};
                    delete res.password;
                    return res;
                }
            }
        } else if(this.sessions.shared[sessionIdOrName]) {
            const s = this.sessions.shared[sessionIdOrName];
            if(s?.settings.password && password !== this.sessions.shared[id]?.settings.password) return undefined; 
            const res = {...(getData? (s.data ? s.data : {}) : s.settings)};
            delete res.password;
            return res;
        } else {
            let res = {};
            for(const id in this.sessions.shared) {
                const s = this.sessions.shared[id];
                if(s.settings?.name === sessionIdOrName) //get by name
                    {
                        if(s?.settings.password && password !== s?.settings.password) continue;
                        res[id] = {...(getData ? (s.data ? s.data : {}) : s.settings)};
                        delete res[id].password;
                    }
            }
            if(Object.keys(res).length > 0) 
                return res;
        }
    }

    //local session user
    createSessionUser = (_id?:string, props?:{}) => {
        if(!_id || this.users[_id]) _id = `user${Math.floor(Math.random()*1000000000000000)}`;
        this.users[_id] = {
            _id,
            send:(...args) => { //this user will receive data locally
                this.handleServiceMessage(...args);
                return undefined;
            },
            request:(...args) => {
                return this.handleServiceMessage(...args);
            },
            sessions:{},
            sessionSubs:{}
        };
        if(props) 
            Object.assign(
                this.users[_id],
                props
            );

        return this.users[_id];
    }

    openStreamSession = (
        options:StreamSessionProps={}, 
        sourceUserId?:string, 
        listenerUserId?:string,
        newSession=true
    ) => {
        if(!options._id) {
            options._id = `stream${Math.floor(Math.random()*1000000000000000)}`;       
        }   
        else if(newSession && this.sessions.stream[options._id]) { //prevent overlap
            delete options._id;
            return this.openStreamSession(
                options,
                sourceUserId,
                listenerUserId
            ); //regen id
        }
        if(options._id && sourceUserId && this.users[sourceUserId]) {
            if(sourceUserId){
                if(!options.settings) 
                    options.settings = { 
                        source:sourceUserId, 
                        listener:listenerUserId, 
                        sessionUserProps:{latency:true}, //example prop
                        admins:{[sourceUserId]:true}, 
                        ownerId:sourceUserId 
                    };
                if(!options.settings.listener) 
                    options.settings.listener = listenerUserId ? listenerUserId : sourceUserId;
                if(!options.settings.source) 
                    options.settings.source = sourceUserId;
                if(!this.users[sourceUserId].sessions) 
                    this.users[sourceUserId].sessions = {};
                this.users[sourceUserId].sessions[options._id] = options;
            }
            if(!options.data) options.data = {};
            if(options.onopen) options.onopen(options);
            if(this.sessions.stream[options._id]) {
                return this.updateSession(options,sourceUserId);
            }
            else if(options.settings?.listener && options.settings.source) 
                this.sessions.stream[options._id] = options; //need the bare min in here
        }
        return options;
    }

    openSharedSession = (
        options:SharedSessionProps, 
        userId?:string,
        newSession=true
    ) => {
        if(!options._id) {
            options._id = `shared${Math.floor(Math.random()*1000000000000000)}`;
        } 
        else if(newSession && this.sessions.shared[options._id]) { //dont overrwrite
            delete options._id;
            return this.openSharedSession(options,userId); //regen id
        }
        if(options._id && userId && this.users[userId]){  
            if(typeof userId === 'string') {
                if(!options.settings) 
                    options.settings = { 
                        name:'shared', 
                        sessionUserProps:{latency:true},  //example prop
                        users:{[userId]:true}, 
                        admins:{[userId]:true}, 
                        ownerId:userId 
                    };
                
                if(!options.settings.users) 
                    options.settings.users = {[userId]:true};
                if(!options.settings.admins) 
                    options.settings.admins = {[userId]:true};
                if(!options.settings.ownerId) 
                    options.settings.ownerId = userId;
                if(!this.users[userId].sessions) 
                    this.users[userId].sessions = {};
                this.users[userId].sessions[options._id] = options;
            } 
            else if (!options.settings) 
                options.settings = {
                    name:'shared', 
                    sessionUserProps:{latency:true},  //example prop
                    users:{}
                };
            if(!options.data) options.data = { host:{}, user:{} };
            if(!options.settings.name) 
                options.settings.name = options._id;
            if(options.onopen) options.onopen(options);
            if(this.sessions.shared[options._id]) {
                return this.updateSession(options,userId);
            }
            else this.sessions.shared[options._id] = options;
        }
        return options;
    }

    open = (options:any,userId?:string, listenerId?:string) => {
        if(options.settings.listener) return this.openStreamSession(options,userId,listenerId);
        else return this.openSharedSession(options,userId);
    }

    //update session properties, also invoke basic permissions checks for who is updating
    updateSession = (
        options:StreamSessionProps | SharedSessionProps, 
        userId?:string
    ) => {
        //add permissions checks based on which user ID is submitting the update
        let session:any;
        if(options._id){ 
            session = this.sessions.stream[options._id];
            if(!session) 
                session = this.sessions.shared[options._id];
            if(session && userId) {
                if(session.settings && (
                    session?.settings.source === userId || 
                    session.settings.admins?.[userId] || 
                    session.settings.moderators?.[userId] || 
                    session.settings.ownerId === userId
                )) {
                    return this.recursivelyAssign(session, options);
                }
            } else if(options.settings?.source) {
                return this.openStreamSession(options as StreamSessionProps,userId);
            } else return this.openSharedSession(options as SharedSessionProps,userId);
        }
        return false;
    }

    //add a user id to a session, Run this at the session host location 
    // it will report back to clientside via the service message send if separate. remoteUser will take care of this on either endpoint for you
    //supply options e.g. to make them a moderator or update properties to be streamed dynamically
    joinSession = (   
        sessionId:string, 
        userId:string,
        sessionOptions?:SharedSessionProps|StreamSessionProps, //can update session settings or create a new session, this is used to set up the session on the user endpoint if this is called remotely
        remoteUser:boolean=true //ignored if no endpoint on user object
    ):SharedSessionProps|StreamSessionProps|false => {
        if(!userId && !this.users[userId]) return false;
        if(!this.users[userId].sessions) this.users[userId].sessions = {};
        let session = this.sessions.shared[sessionId] as SharedSessionProps|StreamSessionProps;
        if(!session) session = this.sessions.stream[sessionId];
        //console.log(session);
        //console.log(sessionId,userId,sesh,this.sessions);
        if(session?.settings) {
            if(session.settings?.banned) {
                if(session.settings.banned[userId]) return false;
            }
            if(session.settings?.password) {
                if(!sessionOptions?.settings?.password) return false;
                if(sessionOptions.settings.password !== session.settings.password) return false
            }
            if(session.settings.users) {
                if(session.settings.maxUsers && Object.keys(session.settings.users) > session.setting.maxUsers) return false;
                (session.settings.users as any)[userId] = true;
                session.settings.newUser = true;
            }
            this.users[userId].sessions[sessionId] = session;
            if(sessionOptions) { return this.updateSession(sessionOptions,userId); };
            //console.log(sesh)
            if(remoteUser && this.users[userId]?.send) {
                this.users[userId].send({route:'joinSession',args:[sessionId,userId,session]}); //callbacks on the sesh should disappear with json.stringify() in the send calls when necessary
            }
            return session; //return the full session and data
        } 
        ///no session so make a new one
        else if (sessionOptions?.source || sessionOptions?.listener) {
            session = this.openStreamSession(sessionOptions as StreamSessionProps, userId);
            if(remoteUser && this.users[userId]?.send) {
                this.users[userId].send({route:'joinSession',args:[sessionId,userId,session]});
            }
            return session;
        }
        else if (sessionOptions) {
            session = this.openSharedSession(sessionOptions as SharedSessionProps, userId);
            if(remoteUser && this.users[userId]?.send) {
                this.users[userId].send({route:'joinSession',args:[sessionId,userId,session]});
            }
            return session;
        }
        return false;
    }

    inviteToSession = (
        session:StreamSessionProps|SharedSessionProps|string,  
        userIdInvited:string, 
        inviteEndpoint?:string, //your user/this socket endpoint's ID as configured on router
        remoteUser:boolean=true
    ) => {
        if(remoteUser && this.users[userIdInvited]?.send) {
            this.users[userIdInvited]?.send({route:'receiveSessionInvite', args:[
                session,
                userIdInvited,
                inviteEndpoint
            ]});
        } else {
            this.receiveSessionInvite(session,userIdInvited,inviteEndpoint);
        }
    }

    //subscribe to this clientside to do stuff when getting notified
    receiveSessionInvite = (
        session:StreamSessionProps|SharedSessionProps|string,  //this session
        userIdInvited:string,  //invite this user
        endpoint?:string //is the session on another endpoint (user or other?)?
    ) => {
        if(!this.invites[userIdInvited]) this.invites[userIdInvited] = {};
        let id = typeof session === 'string' ? session : session._id;
        this.invites[userIdInvited][id] = {session, endpoint};

        return id;
    }

    acceptInvite = ( //will wait for endpoint to come back if remote invitation
        session:StreamSessionProps|SharedSessionProps|string,  //session id is minimum
        userIdInvited:string,
        remoteUser=true
    ):Promise<SharedSessionProps|StreamSessionProps|false> => {
        let id = typeof session === 'string' ? session : session._id;
        let invite = this.invites[userIdInvited]?.[id];
        let endpoint;
        if(invite) {
            session = invite.session;
            endpoint = invite.endpoint;
            delete this.invites[userIdInvited]?.[id];
        }
        return new Promise((res,rej) => {
            if(!id) res(false);
            if(remoteUser && endpoint && this.users[endpoint]?.send) {
                //wait for the remote joinSession call to come back
                let resolved;
                let timeout = setTimeout(()=>{ 
                    if(!resolved) {
                        this.unsubscribe('joinSession',subbed); rej(new Error('Session join timed out'));
                    }  
                },10000);
                let subbed = this.subscribe('joinSession', (result:SharedSessionProps|StreamSessionProps|false)=>{
                    if(typeof result === 'object' && result?._id === id) {
                        if(result.setting?.users?.includes(userIdInvited)) {
                            //we've joined the session
                            this.unsubscribe('joinSession', subbed);
                            resolved = true;
                            if(timeout) clearTimeout(timeout);
                            res(result);
                        }
                    }
                });
                this.users[endpoint]?.send({route:'joinSession',args:[id,userIdInvited,undefined,true]});
                //10sec timeout
            } else res(this.joinSession(id, userIdInvited, typeof session === 'object' ? session : undefined));
        });
    }

    rejectInvite = (
        session:StreamSessionProps|SharedSessionProps|string,  
        userIdInvited:string,
        remoteUser=true
    ) => {
        let id = typeof session === 'string' ? session : session._id;
        if(this.invites[userIdInvited]?.[id]) {
            let endpoint = this.invites[userIdInvited][id].endpoint;
            delete this.invites[userIdInvited][id];
            if(remoteUser && endpoint && this.users[endpoint]?.send) {
                this.users[endpoint].send({route:'rejectInvite',args:[id,userIdInvited]}); //listen on host end too to know if invite was rejected
            }
            return true;
        }
    }

    //Remove a user from a session. Stream sessions will be closed
    //Run this at the session host location
    leaveSession = (
        session:StreamSessionProps|SharedSessionProps|string,  
        userId:string, 
        clear:boolean=true, //clear all data related to this user incl permissions
        remoteUser:boolean=true //send user an all-clear to unsubscribe on their end
    ) => {
        let sessionId:string|undefined;
        if(typeof session === 'string') {
            sessionId = session;
            session = this.sessions.stream[sessionId];
            if(!session) session = this.sessions.shared[sessionId];
        } else sessionId = session._id;
        if(session) {
            if(this.sessions.stream[sessionId]) {
                if( userId === session.settings.source || 
                    userId === session.settings.listener || 
                    session.settings.admins?.[userId] || 
                    session.settings.moderators?.[userId]
                ) {
                    delete this.sessions.stream[sessionId];
                    delete this.users[userId]?.sessions[sessionId];
                    delete this.users[userId]?.sessionSubs?.[sessionId];
                    if(clear) {
                        if(session.settings.admins?.[userId])     delete (this.sessions.shared[sessionId].settings?.admins as any)[userId];
                        if(session.settings.moderators?.[userId]) delete (this.sessions.shared[sessionId].settings?.moderators as any)[userId];
                    }
                    if(remoteUser && this.users[userId]?.send) {
                        this.users[userId].send({route:'unsubscribeFromSession',args:[session._id, userId, clear]});
                    } else {
                        this.unsubsribeFromSession(session, userId, clear);
                    }
                } 
            } else if (this.sessions.shared[sessionId]) {
                delete this.sessions.shared.settings.users[userId];
                delete this.users[userId]?.sessions[sessionId];
                delete this.users[userId]?.sessionSubs?.[sessionId];
                if(clear) {
                    if(session.settings.admins?.[userId])     delete (this.sessions.shared[sessionId].settings?.admins as any)[userId];
                    if(session.settings.moderators?.[userId]) delete (this.sessions.shared[sessionId].settings?.moderators as any)[userId];
                    if(session.data.user[userId]) delete this.sessions.shared[sessionId].data?.user[userId];
                    if(session.settings.host === userId) {
                        this.swapHost(session, undefined, true);
                        delete session.data.user[userId];
                    }
                }
                if(remoteUser && this.users[userId]?.send) {
                    this.users[userId].send({route:'unsubscribeFromSession',args:[session._id, userId, clear]});
                } else {
                    this.unsubsribeFromSession(session, userId, clear);
                }
            }
            return true;
        }
        return false;
    }

    //Delete a session. Run this at the session host location
    deleteSession = (session:string|StreamSessionProps|SharedSessionProps, userId:string, remoteUsers=true) => {
        
        if(typeof session === 'string') { 
            let id = session;
            session = this.sessions.stream[id];
            if(!session) session = this.sessions.shared[id];
        }
        if(session) {
            if(session.source === userId || session.listener === userId || session.admins?.[userId] || session.ownerId === userId) {
                for(const user in session.settings.users) {
                    if(this.users[user]?.sessions) delete this.users[user].sessions[session._id];
                    if(this.users[user]?.sessionSubs) delete this.users[user].sessionSubs[session._id];
                    if(remoteUsers) {
                        if(session.users) {
                            for(const key in session.users) {
                                if(this.users[key]?.send) 
                                    this.users[key].send({route:'unsubscribeFromSession',args:[session._id, key]});
                            }
                        }
                        else if(session.listener) {
                            if(this.users[session.listener]?.send) 
                                    this.users[session.listener].send({route:'unsubscribeFromSession',args:[session._id, session.listener]});
                        } else if (this.users[userId]?.send) {
                            this.users[userId].send({route:'unsubscribeFromSession',args:[session._id, userId]});
                        }
                    } else {
                        this.unsubsribeFromSession(session, user);
                    }
                }
                if(this.sessions.stream[session._id]) delete this.sessions.stream[session._id];
                else if(this.sessions.shared[session._id]) delete this.sessions.stream[session._id];
                if(session.onclose) session.onclose(session);
            }
        }
        return true;
    }

    getFirstMatch(obj1:{[key:string]:any},obj2:{[key:string]:any}) {
        for(const i in obj1) {
            if(i in obj2) return i;
        }
        return false;
    }

    swapHost = (
        session:StreamSessionProps|SharedSessionProps|string, 
        newHostId?:string,
        adoptData:boolean=true, //copy original session hosts data?
        remoteUser=true    
    ) => {
        if(typeof session === 'string') {
            if(this.sessions.stream[session]) session = this.sessions.stream[session];
            else if(this.sessions.shared[session]) session = this.sessions.shared[session];
        }
        if(typeof session === 'object' && session.settings) {
            let oldHost = session.settings.host;
            delete session.settings.host;
            if(newHostId) {
                if(session.settings.users[newHostId]) session.settings.host = newHostId;
            }
            if(session.settings.ownerId && !session.settings.host) {
                if(session.settings.users[session.settings.ownerId]) session.settings.host = session.settings.ownerId;
            }
            if(session.settings.admins && !session.settings.host) {
                let match = this.getFirstMatch(session.settings.users,session.settings.admins);
                if(match) session.settings.host = match;
            }//sendAll leadership when host swapping
            if(session.settings.moderators && !session.settings.host) {
                let match = this.getFirstMatch(session.settings.users,session.settings.moderators);
                if(match) session.settings.host = match;
            }//sendAll leadership when host swapping
            if(!session.settings.host) session.settings.host = Object.keys(session.settings.users)[0]; //replace host 
            if(adoptData && oldHost && session.settings.inheritHostData !== false) {
                if(session.data?.user[oldHost]) { //stream data will stay the same
                    if(session.data?.user[oldHost]) {
                        session.data.user[session.settings.host] = Object.assign(
                            session.data.user[session.settings.host] ? session.data.user[session.settings.host] : {}, 
                            session.data.user[oldHost]
                        );
                        if(remoteUser) {

                        }
                    }
                }
            }
            return true;
        }
        return false;
    }

    //run these on the clientside for the user as a way to set specific handles else use receiveSessionUpdates to watch for all user updates
    subscribeToSession = (
        session:SharedSessionProps|StreamSessionProps|string, 
        userId:string, 
        onmessage?:(session:SharedSessionProps|StreamSessionProps, update:any, user:SessionUser)=>void, 
        onopen?:(session:SharedSessionProps|StreamSessionProps, user:SessionUser)=>void,
        onclose?:(session:SharedSessionProps|StreamSessionProps, user:SessionUser)=>void
    ) => {
        if(typeof session === 'string') {
            let s = this.sessions.stream[session]; 
            if(!s) s = this.sessions.shared[session] as any;
            if(!s) return undefined;
            session = s;
        }
        
        let user = this.users[userId];
        if(!user) return undefined;
        if(!user.sessionSubs) user.sessionSubs = {}; //we'll just look for this object to run callbacks 
        if(!user.sessionSubs[session._id]) user.sessionSubs[session._id] = {};

        if(onmessage) user.sessionSubs[session._id].onmessage = onmessage;
        if(onopen) this.sessionSubs[userId][session._id].onopen = onopen;
        if(onclose) user.sessionSubs[session._id].onclose = onclose;
        if(typeof onopen === 'function') {
            let sub = this.subscribe('joinSession',(res) => {
                if(res._id === (session as any)._id) 
                    this.sessionSubs[userId][(session as any)._id].onopen(session as any, user);
                this.unsubscribe('joinSession', sub as number);
            });
            user.sessionSubs[session._id].onopenSub = sub;
        }
      
        return session;
    }

    //run these on the clientside user
    unsubsribeFromSession = (
        session:SharedSessionProps|StreamSessionProps|string, 
        userId?:string,
        clear=true //clear session data (default true)
    ) => {
        if(typeof session === 'string') {
            let s = this.sessions.stream[session];
            if(!s) s = this.sessions.shared[session] as any;
            if(!s) return undefined;
            session = s;
        } 

        const clearSessionSubs = (Id:string, s:SharedSessionProps|StreamSessionProps) => {
            let u = this.users[Id];
            if(!u) return undefined;
            if(u.sessionSubs?.[s._id]) {
                if(u.sessionSubs[s._id].onopenSub) {
                    this.unsubscribe('joinSession', u.sessionSubs[s._id].onopenSub as number);
                }
            }
            if(u.sessionSubs[s._id].onclose) u.sessionSubs[s._id].onclose(s as any, u);
            delete u.sessionSubs[s._id];
        }

        if(userId) {
            clearSessionSubs(userId, session);
        } else {
            for(const key in this.users) {
                clearSessionSubs(key, session);
            }
        }

        if(clear) {
            if(this.sessions.stream[session._id]) delete this.sessions.stream[session._id];
            else if(this.sessions.shared[session._id]) delete this.sessions.shared[session._id];
        }
    }

    // Utility function to process a single stream session
    processStreamSession = (session: StreamSessionProps, updateObj: any, inputBuffers: any) => {
        // Check if the user associated with the session source exists
        if (!this.users[session.source]) {
            // If the user doesn't exist, delete the session and return undefined
            delete this.sessions.stream[session._id];
            return undefined;
        }

        // Check if the session has settings and data
        if (session.settings && session.data) {
            // Iterate over each property in the session user properties
            for (const prop in session.settings.sessionUserProps) {

                // Check if the property exists in the user data
                if (prop in this.users[session.source]) {
                    if (!inputBuffers[prop] && this.users[session.source].inputBuffers?.[prop]) inputBuffers[prop] = true;
                    // If session data exists
                    if (session.data) {
                        // If the property value is an object
                        if (typeof session.data[prop] === 'object') {
                            // Check if the property in user data differs from session data or the property doesn't exist in session data
                            if (stringifyFast(session.data[prop]) !== stringifyFast(this.users[session.source][prop])
                            ) {
                                // Update the property in updateObj
                                updateObj.data[prop] = this.users[session.source][prop];
                                //console.log(prop,uid);
                            }
                        } else if (session.data[prop] !== this.users[session.source][prop] || !(prop in session.data)) {
                            // For non-object properties, update if different or doesn't exist in session data
                            updateObj.data[prop] = this.users[session.source][prop];
                        }
                    } else {
                        // If session data doesn't exist, directly update the property
                        updateObj.data[prop] = this.users[session.source][prop];
                    }
                } else if (session.data && prop in session.data) {
                    // If the property doesn't exist in user data but exists in session data, delete it from session data
                    delete session.data[prop];
                }
            }
        }

        // If there are any updates to apply
        if (Object.keys(updateObj.data).length > 0) {
            // Recursively assign the updates to the session data
            if(!session.data) session.data = {};
            this.recursivelyAssign(session.data, updateObj.data);
            //console.log(session);
            // Return the update object
            return updateObj;
        }

        // Return undefined if no updates were found
        return undefined;
    };

    // Utility function to process a single shared session
    processSharedSession = (session: SharedSessionProps, updateObj: any, inputBuffers: any) => {
    
        const sharedData = {}; // Initialize shared data

        // Check if session settings have users
        if (session.settings?.users) {
            // Iterate over each user in the session settings
            for (const uid in session.settings.users) {
                // Check if the user exists
                if (!this.users[uid]) {
                    // If the user doesn't exist, delete the user from session settings
                    delete session.settings.users[uid];
                    // Swap host if the deleted user was the host
                    if (session.settings.host === uid) this.swapHost(session, undefined, true);
                    // Delete user data from session data
                    if (session.data?.user?.[uid]) delete session.data.user[uid];
                    if (session.data?.stream?.[uid]) delete session.data.stream[uid];
                    // Update the settings object
                    updateObj.settings.users = session.settings.users;
                    updateObj.settings.host = session.settings.host;
                    // Continue to the next user
                    continue;
                }
                // Skip spectators
                if (session.settings.spectators?.[uid]) continue;

                sharedData[uid] = {}; // Initialize shared data for user
                const props = (uid === session.settings.host ? session.settings.sessionHostProps : session.settings.sessionUserProps ? session.settings.sessionUserProps : {})
                for (const prop in props) {
                    // Check if the property exists in user data
                    if (prop in this.users[uid]) {
                        if (this.users[uid].inputBuffers?.[prop]) inputBuffers[prop] = true;
                        // Handle object properties
                        if (session.data?.user?.[uid] && !(prop in session.data.user[uid])) {
                            if (typeof this.users[uid][prop] === 'object' && !Array.isArray(this.users[uid][prop])) {
                                // Assign recursively if the property is an object
                                sharedData[uid][prop] = this.recursivelyAssign({}, this.users[uid][prop]);
                            } else {
                                sharedData[uid][prop] = this.users[uid][prop];
                            }
                        } else if (typeof session.data?.user?.[uid]?.[prop] === 'object') {
                            if (stringifyFast(session.data.user[uid][prop]) !== stringifyFast(this.users[uid][prop])) {
                                // Update if the property is an object and has changed
                                sharedData[uid][prop] = this.users[uid][prop];
                                //console.log(prop,uid);
                            }
                        } else if (session.data?.user[uid]?.[prop] !== this.users[uid][prop]) {
                            // Update if the property value has changed
                            sharedData[uid][prop] = this.users[uid][prop];
                        }
                    } else if (session.data?.user?.[uid] && prop in session.data.user[uid]) {
                        // Delete the property if it exists in session data but not in user data
                        delete session.data.user[uid][prop];
                    }
                }

                // Delete shared data for the user if no properties exist
                if (Object.keys(sharedData[uid]).length === 0) delete sharedData[uid];
            }

            if(session.settings.host) {
                //console.log(sharedData);
                let dataForHost = sharedData;
                let dataForUser = {};
                if(sharedData[session.settings.host]) {
                    dataForUser[session.settings.host] = sharedData[session.settings.host]; //users should just receive data of the host
                }

                if(Object.keys(dataForUser) > 0) {
                    updateObj.data.user = dataForUser; 
                }
                if(Object.keys(dataForHost) > 0) {
                    updateObj.data.host = dataForHost; 
                }

            } else if (Object.keys(sharedData).length > 0) {
                updateObj.data.user = sharedData; // Add shared data to the update object if it has any properties
            }

            
        }

        // Return the update object if it has user or host data
        if (updateObj.data.user || updateObj.data.host) {
            if(!session.data) session.data = {};
            this.recursivelyAssign(session.data, updateObj.data);
            return updateObj;
        }

        // Return undefined if no updates were found
        return undefined;
    };

    // Utility function to get updates for stream sessions
    getStreamSessionUpdates = (sessionHasUpdate?: (session: StreamSessionProps, update: { stream?: any }) => void) => {
        let streamUpdates: any = {}; // Initialize stream updates object
        let inputBuffers = {}; // Initialize input buffers object

        // Iterate through stream sessions
        for (const sid in this.sessions.stream) {
            const session = this.sessions.stream[sid];
            const updateObj = {
                _id: session._id,
                settings: {
                    listener: session.settings.listener,
                    source: session.settings.source
                },
                data: {}
            } as any;

            const updatedSession = this.processStreamSession(session, updateObj, inputBuffers); // Process stream session
            if (updatedSession) {
                streamUpdates[session._id as string] = updatedSession; // Add updated session to stream updates
                if (sessionHasUpdate) sessionHasUpdate(session, updatedSession); // Invoke session update callback if provided
                if (session.settings.onhasupdate) session.onhasupdate(session, updatedSession); // Invoke onhasupdate callback if provided
            }
        }
        return { streamUpdates, inputBuffers }; // Return stream updates and input buffers
    };

    // Utility function to get updates for shared sessions
    getSharedSessionUpdates = (sessionHasUpdate?: (session: SharedSessionProps, update: { shared?: any }) => void) => {
        let sharedUpdates: any = {}; // Initialize shared updates object
        let inputBuffers = {}; // Initialize input buffers object

        // Iterate through shared sessions
        for (const sid in this.sessions.shared) {
            const session = this.sessions.shared[sid];
            const updateObj = {
                _id: session._id,
                settings: {
                    name: session.settings.name
                },
                data: {}
            } as any;

            const updatedSession = this.processSharedSession(session, updateObj, inputBuffers); // Process shared session
            if (updatedSession) {
                sharedUpdates[session._id as string] = updatedSession; // Add updated session to shared updates
                if (sessionHasUpdate) sessionHasUpdate(session, updatedSession); // Invoke session update callback if provided
                if (session.settings.onhasupdate) session.settings.onhasupdate(session, updatedSession); // Invoke onhasupdate callback if provided
            }
        }

        return { sharedUpdates, inputBuffers }; // Return shared updates and input buffers
    };

    userUpdates: { [key: string]: any } = {}; // Intermediate object for user updates

    // Main function to check for session updates and transmit if any are found
    sessionUpdateCheck = (
        sessionHasUpdate?: (session: StreamSessionProps | SharedSessionProps, update: { shared?: any, stream?: any }) => void,
        transmit = true
    ) => {
        // Get updates for stream sessions
        const { streamUpdates, inputBuffers: streamInputBuffers } = this.getStreamSessionUpdates(sessionHasUpdate);

        // Get updates for shared sessions
        const { sharedUpdates, inputBuffers: sharedInputBuffers } = this.getSharedSessionUpdates(sessionHasUpdate);

        // Merge input buffers from both stream and shared sessions
        const inputBuffers = { ...streamInputBuffers, ...sharedInputBuffers };

        // Combine updates from both stream and shared sessions
        let updates: any = {
            stream: streamUpdates,
            shared: sharedUpdates
        };

        // Clean up empty update objects
        if (Object.keys(updates.stream).length === 0) delete updates.stream;
        if (Object.keys(updates.shared).length === 0) delete updates.shared;
        if (Object.keys(updates).length === 0) return undefined; // Return undefined if no updates

        // Transmit the session updates if the transmit flag is set
        if (transmit) this.transmitSessionUpdates(updates, inputBuffers);


        return updates; // Return the updates object
    };

    // Apply updates to user objects
    applyUserUpdates = () => {
        for (const userId in this.userUpdates) {
            const user = this.users[userId];
            if (user) {
                this.recursivelyAssign(user, this.userUpdates[userId]);
            }
        }
        // Clear the userUpdates object after applying updates
        this.userUpdates = {};
    };

    //transmit updates to users and setState locally based on userId. 
    //possible: this could be more efficient like using a single object of sessionUserProps and a list of sessionids updated then we set it that way on receiveSessionUpdates
    transmitSessionUpdates = (
        updates:{
            stream:{[key:string]:any},
            shared:{[key:string]:any}
        }, 
        clearBuffers:{[key:string]:boolean} //deletes these keys on the users for replacing new input buffers
    ) => {
        let userUpdates = {};
        if(updates.stream) {
            for(const s in updates.stream) { //stream session ids updated
                let session = this.sessions.stream[s]; //get the stream object
                if(session?.settings) {
                    let u = session.settings.listener; //single user listener
                    if(!userUpdates[u]) userUpdates[u] = { stream:{} };
                    if(!userUpdates[u].stream) userUpdates[u].stream = {};
                    else userUpdates[u].stream[s] = updates.stream[s];
                }
            }
        }
        if(updates.shared) {
            for(const s in updates.shared) { //shared session ids updated
                let session = this.sessions.shared[s];//get the stream object
                if(session?.settings) {
                    for(const u in session.settings.users) { //for users in session
                        if(!userUpdates[u]) userUpdates[u] = { shared:{} };
                        if(!userUpdates[u].shared) userUpdates[u].shared = {};
                        else {
                            if(session.settings.host) {
                                if(u === session.settings.host) {
                                    userUpdates[u].shared[s] = {
                                        ...updates.shared[s],
                                        data:{ host:updates.shared[s].data.host } //overwrite data so we just transmit this to the host
                                    }
                                } else {
                                    userUpdates[u].shared[s] = {
                                        ...updates.shared[s],
                                        data:{ user:updates.shared[s].data.user } //overwrite data so we just transmit this to the users
                                    }
                                }
                            } else {
                                userUpdates[u].shared[s] = updates.shared[s];
                            }
                        }
                    }
                }
            }
        }
 
        //each user will receive an update for all sessions they are subscribed to
        //console.log(users);
        let message = {route:'receiveSessionUpdates', args:undefined as any}
        for(const u in userUpdates) { //each user gets a bulk update of props related to their session
            const usr = this.users[u];
            if(clearBuffers) { //now we'll delete these keys that we assume are being treated as input buffers
                for(const key in clearBuffers) {
                    if(usr[key]) delete usr[key];
                }
            }
            if(usr?.send) {
                message.args = [
                    u, 
                    userUpdates[u]
                ];
                usr.send(message);
            }
            else this.setState({[u]:userUpdates[u]}); //else indicate locally the user updated e.g. for custom logic or a local game state
     
        }

        // Apply user updates after the transmit check
        if(Object.keys(this.userUpdates > 0)) this.applyUserUpdates();

        return userUpdates;
    }

    //e.g. run this on the user end to transmit updates efficiently to the session host who is 
    //   running the sessionLoop (which will take care of the host's props too if they are in the session as their own user)
    userUpdateCheck = (
        user:SessionUser|string, 
        onupdate?:(user:SessionUser, updateObj:{[key:string]:any})=>void
    ) => {
        if(typeof user === 'string') user = this.users[user];
        if(user?.sessions) {
            const updateObj = this.getUpdatedUserData(user);
            
            if(Object.keys(updateObj.data).length > 0) {
                let message = { route:'setUserProps', args:[user._id, updateObj] };
                if(user.inputBuffers) {
                    for(const key in user.inputBuffers) {
                        delete user[key]; //this will clear these buffers for next pass
                    }
                }
                if(user.send) user.send(message);
                else this.setState({[user._id]:message});
                if(onupdate) { onupdate(user, updateObj.data) };
                return updateObj;
            } 
        }
        return undefined; //state won't trigger if returning undefined on the loop
    }

    //receive updates as a user, subscribe to this to get the most recent data for this user
    receiveSessionUpdates = (
        forUserId:any, 
        update:{
            stream:{[key:string]:any},
            shared:{[key:string]:any}
        }|string
    ) => { //following operator format we get the origin passed
        if(update) if(typeof update === 'string') update = JSON.parse(update as string);
        if(!forUserId) return false;
        console.log(update);
        if(typeof update === 'object') {
            let user = this.users[forUserId];
            if(user) {
                if(!user.sessions) user.sessions = {stream:{},shared:{}};
                if(!user.sessionSubs) user.sessionSubs = {};
            }

            if(update.stream) {
                for(const key in update.stream) {
                    if(!this.sessions.stream[key]) {continue;} //not subscribed, should not be receiving 
                    
                    this.recursivelyAssign(this.sessions.stream[key].data, update.stream[key].data);
                    
                    if(this.sessions.stream[key]?.settings.onmessage) //session callback
                        this.sessions.stream[key].settings.onmessage(this.sessions.stream[key], update.stream[key]);
                    
                    if(user?.sessionSubs?.[key]?.onmessage) //user specific callback
                        user.sessionSubs[key].onmessage(user.sessions[key], update.stream[key], user);
                    this.setState({[key]:this.sessions.stream[key]}); //subscribe to this id on the state alternatively
                }
            }
            if(update.shared) {
                for(const key in update.shared) {
                    if(!this.sessions.shared[key]) {continue;} //not subscribed, should not be receiving 
                    if(update.shared[key].settings.users) 
                        this.sessions.shared[key].settings.users = update.shared[key].settings.users;
                    if(update.shared[key].settings.host) 
                        this.sessions.shared[key].settings.host = update.shared[key].settings.host;
                    if(update.shared[key].data.host) 
                        this.recursivelyAssign(this.sessions.shared[key].data.host, update.shared[key].data.host);
                    if(update.shared[key].data.user)  
                        this.recursivelyAssign(this.sessions.shared[key].data.user, update.shared[key].data.user);
                    if(this.sessions.shared[key]?.settings.onmessage) 
                        this.sessions.shared[key].settings.onmessage(this.sessions.shared[key], update.shared[key]);
                    if(user?.sessionSubs?.[key]?.onmessage)
                        user.sessionSubs[key].onmessage(user.sessions[key], update.shared[key], user);
                    this.setState({[key]:this.sessions.shared[key]}); //subscribe to this id on the state alternatively
                }
            }
            return user;
        }
    }

    getUserSessionData = (user:SessionUser, sessionNameOrId:string) => {
        if(user.sessions?.stream[sessionIdOrName]) {
            return user.sessions.stream[sessionIdOrName];
        } else if(user.sessions?.shared[sessionIdOrName]) {
            return user.sessions.shared[sessionIdOrName];
        } else {
            let res = {};
            for(const id in user.sessions?.shared) {
                if(user.sessions.shared[id].settings?.name === sessionIdOrName) //get by name
                {
                    res[id] = user.sessions.shared[id];
                }
            }
            if(Object.keys(res).length > 0) return res;
        }
    }

    //this efficiently gets updated user data by matching data on the session object (sent by host/server) and the user object (independent)
    getUpdatedUserData = (user:SessionUser) => {
        const updateObj = {data:{}};
        for(const key in user.sessions) {
            let s = user.sessions[key];
            if(!s.localdata) s.localdata = {};
            if(s.settings.users?.[user._id] || s.settings.source === user._id) {
                if(!s.settings.spectators?.[user._id]) {
                  
                    for(const prop in s.settings.sessionUserProps) {
                        if(!(prop in updateObj) && prop in user) {
                            if(s.settings.source === user._id) {
                                if(typeof user[prop] === 'object' && prop in s.localdata?.user?.[user._id]) {
                                    if(stringifyFast(s.localdata?.user?.[user._id][prop]) !== stringifyFast(user[prop]))
                                        updateObj.data[prop] = user[prop];
                                }
                                else if (s.localdata?.user?.[user._id][prop] !== user[prop]) 
                                    updateObj.data[prop] = user[prop];  
                            }
                            else {
                                if(s.localdata.user?.[user._id] && prop in s.localdata.user?.[user._id]) { //host only sessions have a little less efficiency in this setup
                                    if(typeof user[prop] === 'object') {
                                        if(stringifyFast(s.localdata.user[user._id][prop]) !== stringifyFast(user[prop]))
                                            updateObj.data[prop] = user[prop];

                                    }
                                    else if (s.localdata.user?.[user._id ][prop] !== user[prop]) 
                                        updateObj.data[prop] = user[prop];
                                } else 
                                    updateObj.data[prop] = user[prop];

                            }
                            if(updateObj.data[prop] && user.inputBuffers[prop]) {
                                if(!updateObj.inputBuffers) updateObj.inputBuffers = {};
                                updateObj.inputBuffers[prop] = true;
                            }
                        }
                    }
                    if(!s.localdata.user) s.localdata.user = {}; //store update locally to not repeat, could be overwritten by server
                    if(!s.localdata.user[user._id]) s.localdata.user[user._id] = {};
                    this.recursivelyAssign(s.localdata.user[user._id], updateObj.data); //as host we should keep the record locally
                
                }
                
            }
        }
        return updateObj;
    }

    //this gets run on the session host/server end when the user passes updates via userUpdateCheck
    setUserProps = (
        user: string | SessionUser,
        props: { [key: string]: any } | string
    ) => {
        if (user) if (typeof user === 'string') {
            user = this.users[user as string];
            if (!user) return false;
        }
        if (props) if (typeof props === 'string') {
            props = JSON.parse(props as string);
        }
        if (!this.userUpdates[user._id]) this.userUpdates[user._id] = {};

        if (props.inputBuffers) {
            if (!this.userUpdates[user._id].inputBuffers) this.userUpdates[user._id].inputBuffers = props.inputBuffers;
            else Object.assign(this.userUpdates[user._id].inputBuffers, props.inputBuffers);
        }
        let bufs = {};
        let hasInpBuf;
        for (const key in props.data) {
            if (this.userUpdates[user._id].inputBuffers?.[key]) {
                bufs[key] = props.data[key];
                hasInpBuf = true;
                delete props.data[key];
            }
        }

        if (hasInpBuf) this.bufferInputs(this.userUpdates[user._id], bufs);

        // Update the intermediate object with the new props
        Object.assign(this.userUpdates[user._id], props.data);

        return true;
    }


    //we want to call this to allocate input buffers which are just rolling buffers that get flushed after transmission, this helps keep track of states when we are otherwise transmitting on schedules over networks with those constraints
    bufferInputs = (
        user:string|SessionUser, 
        inputBuffers:{[key:string]:any}
    ) => {
        if(user) if(typeof user === 'string') {
            user = this.users[user as string];
            if(!user) return false;
        }
        if(inputBuffers) {
            if(!(user as SessionUser).inputBuffers) user.inputBuffers = {};
            for(const key in inputBuffers) {
                user.inputBuffers[key] = true;
                if(!(key in user)) {
                    if(!Array.isArray(inputBuffers[key])) user[key] = [inputBuffers[key]];
                    else user[key] = [...inputBuffers[key]];
                }
                else if(Array.isArray(user[key])) {
                    if(!Array.isArray(inputBuffers[key])) user[key].push(inputBuffers[key]);
                    else user[key].push(...inputBuffers[key]);
                } else {
                    if(!Array.isArray(inputBuffers[key])) [user[key], inputBuffers[key]];
                    else user[key] = [user[key], ...inputBuffers[key]];
                }
            }
        }
        return true;
    }

    

    //service.run('sessionLoop', user, onupdate?); //to engage the loop, we will run this on the user frontend
    userUpdateLoop = { //you can run and subscribe to this on the frontend for a specific user to get a specific timed update check, else subscribe to receiveSessionUpdates for on time updates or use the onmessage function
        __operator:this.userUpdateCheck, 
        __node:{loop:10}//this will set state each iteration so we can trigger subscriptions on session updates :O
    }

    //service.run('sessionLoop', sessionHasUpdate?, transmit?); //to engage the loop
    sessionLoop = { //run this on the host
        __operator:this.sessionUpdateCheck, 
        __node:{loop:10}//this will set state each iteration so we can trigger subscriptions on session updates :O
    }


}



