/* 
    esbuild + nodejs development server. 
    Begin your javascript application here. This file serves as a simplified entry point to your app, 
    all other scripts you want to build can stem from here if you don't want to define more entryPoints 
    and an outdir in the bundler settings.

    Just ctrl-A + delete all this to get started on your app.

*/

import { SessionsService, StreamSessionProps, SharedSessionProps } from '../../src/services/sessions/sessions.service'
import { testObjectStream } from '../../src/services/sessions/stream.service';
import { CanvasWithControls, DrawEventData } from '../../../../examples/sessions/src/CanvasWithControls'
import '../../../../examples/sessions/src/CanvasWithControls' //this will instantiate the customElement

//testObjectStream();

const sessions = new SessionsService();
//if we pass in the users object from the router then it will watch when users are added/removed

const user1 = sessions.createSessionUser('user1'); //e.g. user on endpoint 1
const user2 = sessions.createSessionUser('user2'); //e.g. user on endpoint 2

//for stream sessions we will treat the user 1 as host and only receive updates from user1 ost on the user2 canvas
//for shared sessions we will propagate both ways on the canvases

//user updates will propagate to the session, then the session will propagate latest updates back to the users
sessions.run('sessionLoop'); //host of session will run this, or say a web server host
sessions.run('userUpdateLoop', 'user1');
sessions.run('userUpdateLoop', 'user2');


const stream:StreamSessionProps = { //in this stream example 
    settings:{
        source:'user1', 
        listener:'user2', 
        sessionUserProps:{
            drawUpdate:true,
            drawState:true
        }
    } 
};
const shared:SharedSessionProps = {
    settings:{
        name:'sharedtest',
        sessionUserProps:{
            drawUpdate:true,
            drawState:true
        }
    }
};

const hosted:SharedSessionProps = {
    settings:{
        name:'hostedtest',
        sessionUserProps:{
            drawUpdate:true,
            drawState:true
        },
        sessionHostProps:{
            drawUpdate:true,
            drawState:true
        }
    }
};

//if we are communicating across a socket, we'd call this on the end that we are hosting the data on, e.g. a host user or a backend server
const streamSes = sessions.open(stream,'user1');
const sharedSes = sessions.open(shared,'user1');
const hostedSes = sessions.open(hosted,'user1');

sessions.swapHost(hostedSes._id, 'user1', false, false);

console.log('stream', streamSes, 'shared', sharedSes, 'hosted', hostedSes);

//normally we'd do a lookup to get the ids or get the id sent specially for private streams, and for stream sessions we'd have the special id set, 
//i.e. we run this on the host by sending this command over websocket or webrtc
//run for user 1 to get the session data, you can use this to get the session id for shared sessions since you may want to list names on like a session browser
//let sharedSesSettings = sessions.getSessionInfo('user1', 'sharedtest');
//let hostedSesSettings = sessions.getSessionInfo('user1', 'hostedtest');
//run for user 2
//let streamSesSettings = sessions.getSessionInfo('user2', streamSes._id);
//let sharedSesSettings = sessions.getSessionInfo('user2', 'sharedtest');
//let hostedSesSettings = sessions.getSessionInfo('user2', 'hostedtest');

//first user joined when session was created, second user joins after, now when the user updates the keys specified by the session, it will propagate on the update loop
sessions.joinSession(stream._id as string, 'user2', undefined, false);
sessions.joinSession(shared._id as string, 'user2', undefined, false);
sessions.joinSession(hosted._id as string, 'user2', undefined, false);

//after joining we need to subscribe to the session as the users, this would be done on their sessions object on their own client

const drawelem1 = document.createElement('canvas-with-controls') as CanvasWithControls; //associate with user 1 
const drawelem2 = document.createElement('canvas-with-controls') as CanvasWithControls; //associate with user 2

//setup onmessage and onclose behavior, we already joined so skip onopen
sessions.subscribeToSession(
    stream._id as string, 'user2', 
    (session, update) => { //streams are one way, so the listener is receiving updates
        console.log('user2, stream', update); //update.drawUpdate
    }, 
    undefined, 
    (session) => {
        console.log('user2, stream closed');
    }
);

let rcvCt = 0;
sessions.subscribeToSession(shared._id as string, 'user1', (session, update) => {
    //console.log('user1, shared', update); //update.shared.user2.drawUpdate
    if(update.data?.user?.user2?.drawUpdate) {
        //console.log('passing data from user 2 board to user 1 board',update.data.user.user2.drawUpdate);
        drawelem1.replayActions(update.data.user.user2.drawUpdate);
    }
}, undefined, (session) => {
    console.log('user1, shared closed');
});

sessions.subscribeToSession(shared._id as string, 'user2', (session, update) => {
    //console.log('user2, shared', update); //update.shared.user1.drawUpdate
    if(update.data?.user?.user1?.drawUpdate) {
        //rcvCt += update.data.user.user1.drawUpdate.length;
        //console.log("received:", rcvCt);
        //console.log(update.data.user.user1.drawUpdate);
        drawelem2.replayActions(update.data.user.user1.drawUpdate);
    }
}, undefined, (session) => {
    console.log('user2, shared closed');
});

sessions.subscribeToSession(hosted._id as string, 'user1', (session, update) => {
    console.log('user1, hosted', update); //update.host.user2.drawUpdate
}, undefined, (session) => {
    console.log('user1, hosted closed');
});

sessions.subscribeToSession(hosted._id as string, 'user2', (session, update) => {
    console.log('user2, hosted', update); //update.shared.user1.drawUpdate
}, undefined, (session) => {
    console.log('user2, hosted closed');
});

//todo: propagate inputs to drawelem.replayActions(user.drawUpdate) when defined


document.body.appendChild(drawelem1);
document.body.appendChild(drawelem2);

//let updateCt = 0;
if (drawelem1) {
    drawelem1.subscribeDrawHandler((detail: DrawEventData) => {
        // Set the data on the user object
        user1.drawState = detail;
        // Buffer the input using the session's input buffer system
        //console.log("sent: ", updateCt++);
        sessions.bufferInputs(user1, { drawUpdate: detail });
    });
}

if (drawelem2) {
    drawelem2.subscribeDrawHandler((detail: DrawEventData) => {
        // Set the data on the user object
        user2.drawState = detail;

        // Buffer the input using the session's input buffer system
        sessions.bufferInputs(user2, { drawUpdate: detail });
    });
}
//next test we will set up a web socket and use the server to route updates 