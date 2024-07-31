import {
  InputBuffer, CircularBuffer, DelayBuffer, DelayBufferManager,
  DelayedGetterRules,
} from '../../src/services/sessions/buffers'
import {
  testDelayBuffers, testDelayBufferManagers, testSessionManagers, testCombinedManagers
} from '../../src/services/sessions/tests'

import { SessionService } from '../../src/services/sessions/sessions.service'


import { CanvasWithControls } from './src/CanvasWithControls';
import './src/CanvasWithControls'



// Example usage

import './index.css'

//testDelayBuffers();
//testDelayBufferManager();
//testSessionManager();
//testCombinedManagers();

//one way round trip example to communicate from one screen to another 
export const testCombinedManagersWithWebSocket = () => {
  const drawelem1 = document.createElement('canvas-with-controls') as CanvasWithControls; //associate with user 1 
  const drawelem2 = document.createElement('canvas-with-controls') as CanvasWithControls; //associate with user 2

  document.body.appendChild(drawelem1);
  document.body.appendChild(drawelem2);
  // Create DelayBufferManager instance
  const delayBufferManager1 = new DelayBufferManager(10); // aggregate poll every 1000 milliseconds

  // Create WebSocket connection to the server
  const ws = new WebSocket('ws://localhost:8080/');

  // Handle incoming messages from the WebSocket server
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    //console.log('Received message from server:', message);

    if (message.route === 'update') {
      //console.log('Split Updates by User:', message.data);
      if (message.data.user2.session1?.detail) {
        drawelem2.replayActions(message.data.user2.session1.detail)
      }
    }

    if (message.route === 'stopPolling') {
      ws.close();
    }
  };

  // Create session and add user to the session on the server
  ws.onopen = () => {
    console.log("Connected!");
    ws.send(JSON.stringify({
      route: 'createSession',
      args: [
        'session1', // sessionId
        'admin', // creatorId
        {
          curState: 'state',
          inputs: 'inpbuf',
          inpHistory: { type: 'circbuf', length: 100 },
          detail: 'inpbuf'
        }, // delayBufferRules
        { password: 'secret' } // sessionRules
      ]
    }));

    ws.send(JSON.stringify({
      route: 'addUser',
      args: ['session1', 'user2', 'secret'] // sessionId, userId, password
    }));

    ws.send(JSON.stringify({
      route: 'startPolling'
    }));


    // Start generating data
    //generateDataForDelayBufferManager();
    // Start polling
    delayBufferManager1.startPolling();

    // // Stop polling after 10 seconds
    // setTimeout(() => {
    //     clearInterval(interval);
    //     delayBufferManager1.stopPolling();
    //     //ws.send(JSON.stringify({route:'stopPolling'}))
    //     //ws.close();
    // }, 10000);
  };

  // Create buffers
  delayBufferManager1.createBuffer(
    'session1',
    {
      curState: 'state',
      inputs: 'inpbuf',
      inpHistory: { type: 'circbuf', length: 20 },
      detail: 'inpbuf'
    }
  );

  delayBufferManager1.onupdate = (aggregatedBuffer) => {
    console.log('Aggregated Buffer from Manager1 updated:', aggregatedBuffer);
    if (aggregatedBuffer['session1']) {
      ws.send(JSON.stringify({ route: 'updateBuffer', args: ['session1', aggregatedBuffer['session1'], 'admin'] }));
    }
  };

  let interval: any;
  // Function to generate data 10 times per second for DelayBufferManager
  const generateDataForDelayBufferManager = () => {
    const states = ['A', 'B', 'C', 'D'];
    interval = setInterval(() => {
      let sourceObject = {} as any;
      sourceObject.curState = states[Math.floor(Math.random() * states.length)];
      sourceObject.inputs = Array.from({ length: 4 }, (v, i) => {
        if (i === 3) return sourceObject.curState;
        return states[Math.floor(Math.random() * states.length)];
      });
      sourceObject.inpHistory = sourceObject.inputs;
      delayBufferManager1.updateBuffer('session1', sourceObject);
    }, 100);
  };

  drawelem1.subscribeDrawHandler((detail) => {
    delayBufferManager1.updateBuffer('session1', { detail: detail });
  })


};

//testCombinedManagersWithWebSocket();


//SessionService instead of SessionManager and with bidirectional communication
function testSessionService() {

  const drawelem1 = document.createElement('canvas-with-controls') as CanvasWithControls; //associate with user 1 
  const drawelem2 = document.createElement('canvas-with-controls') as CanvasWithControls; //associate with user 2

  document.body.appendChild(drawelem1);
  document.body.appendChild(drawelem2);

  const bufferRules = {  // delayBufferRules
    // curState: 'state',
    // inputs: 'inpbuf',
    // inpHistory: { type: 'circbuf', length: 100 },
    detail: 'inpbuf',
    detail2: 'inpbuf'
  } as DelayedGetterRules;

  const pollPeriod = 100;

  const createUser1 = () => {

    return new Promise((res) => {
      const ws = new WebSocket("http://localhost:8080/");

      const userId = 'user1';

      let sessions1 = new SessionService(
        undefined,
        pollPeriod,
        (
          userUpdate,
          sessionsUpdated,
          user
        ) => {
          //need to handle updates locally, if unspecified it will default to the remote .send call defined on a user slot (so server can repeat updates back to users via a connection)
          //console.log("sending update", userUpdate, 'for user', user._id);
          ws.send(JSON.stringify({
            route: 'updateSessions', //should buffer session updates on the backend
            args: [user._id, user.token, userUpdate, user._id, { session1: 'secret' }]
          }))
        },
        {
          [userId]: { //define a user, when using Router.addUser it will generate handlers for us if we provide connection info
            send: (data) => { //define this to aggregate data for the user to the backend via the send handler
              if (typeof data === 'object') { //todo: automate this, might be useful in general as a convention
                //automatically add userId and token that the session manager expects if the route is on the sessionManager
                if (data.route && typeof sessions1.sessionManager[data.route] === 'function') {
                  if ('args' in data) { //modify sessionManager calls to lead args with the required user id and token (todo: build it in)
                    if (Array.isArray(data.args) && data.args[1] !== sessions1.users[userId].token) {
                      data.args = [userId, sessions1.users[userId].token, ...data.args];
                    }
                    else[userId, sessions1.users[userId].token, data.args];
                  } else data.args = [userId, sessions1.user[userId].token];
                }
              }
              if (typeof data !== "string")
                data = JSON.stringify(data);
              ws.send(data);
            }
          }
        }
      );

      drawelem1.subscribeDrawHandler((detail) => {
        sessions1.sessionManager.updateBuffer('session1', { detail: detail }, userId);
      });

      sessions1.subscribe('receiveSessionData', (sessionData: any) => {
        //console.log('received', sessionData);
        if (sessionData.session1?.detail)
          drawelem2.replayActions(sessionData.session1.detail);
      });

      ws.onmessage = (ev) => {
        if (ev.data) {
          let data = JSON.parse(ev.data);
          //console.log(data);
          if (data?.route) {
            sessions1.receive(data); //receive update objects from the session service
          }
        }
      }

      ws.onopen = (ev) => {
        //set up the user socket connections 
        sessions1.sessionManager.startPolling();

        const t = sessions1.generateSessionToken(userId);
        sessions1.setSessionToken(userId, t, true); //this also establishes the user's id on the server

        sessions1.sessionManager.createSession( //local session
          'session1',
          userId,
          bufferRules,
          //{ password:'secret' } // sessionRules
        )

        sessions1.messageRemoteSession(
          userId, t,
          'startPolling'
        )

        sessions1.messageRemoteSession(
          userId, t,  //user validation (so we can't spoof)
          'createSession',
          'session1',
          userId,
          bufferRules,
          { password: 'secret' } // sessionRules
        );

        sessions1.messageRemoteSession(
          userId, t,  //user validation (so we can't spoof)
          'addUserToSession', 'session1', userId, 'secret' //SessionManager.addUserToSession call
        );

        res(true);
      }



    });

  }


  const createUser2 = () => {
    return new Promise((res) => {
      //2nd user, bidirectional communications 
      const ws2 = new WebSocket("http://localhost:8080/");


      const userId2 = 'user2';

      let sessions2 = new SessionService(
        undefined,
        pollPeriod,
        (
          userUpdate,
          sessionsUpdated,
          user
        ) => {
          //need to handle updates locally, if unspecified it will default to the remote .send call defined on a user slot (so server can repeat updates back to users via a connection)
          console.log("sending update", userUpdate, 'for user', user._id);
          ws2.send(JSON.stringify({
            route: 'updateSessions', //should buffer session updates on the backend
            args: [user._id, user.token, userUpdate, user._id, { session1: 'secret' }]
          }))
        },
        {
          [userId2]: { //define a user, when using Router.addUser it will generate handlers for us if we provide connection info
            send: (data) => { //define this to aggregate data for the user to the backend via the send handler
              if (typeof data === 'object') { //todo: automate this, might be useful in general as a convention
                //automatically add userId and token that the session manager expects if the route is on the sessionManager
                if (data.route && typeof sessions2.sessionManager[data.route] === 'function') {
                  if ('args' in data) { //modify sessionManager calls to lead args with the required user id and token (todo: build it in)
                    if (Array.isArray(data.args) && data.args[1] !== sessions2.users[userId2].token) {
                      data.args = [userId2, sessions2.users[userId2].token, ...data.args];
                    }
                    else[userId2, sessions2.users[userId2].token, data.args];
                  } else data.args = [userId2, sessions2.user[userId2].token];
                }
              }
              if (typeof data !== "string")
                data = JSON.stringify(data);
              ws2.send(data);
            }
          }
        }
      );

      ws2.onmessage = (ev) => {
        if (ev.data) {
          let data = JSON.parse(ev.data);
          //console.log(data);
          if (data?.route) {
            sessions2.receive(data); //receive update objects from the session service
          }
        }
      }

      drawelem2.subscribeDrawHandler((detail2) => {
        sessions2.sessionManager.updateBuffer('session1', { detail2: detail2 }, userId2);
      });

      sessions2.subscribe('receiveSessionData', (sessionData: any) => {
        //console.log('received', sessionData);
        if (sessionData.session1?.detail2)
          drawelem1.replayActions(sessionData.session1.detail2);
      });

      ws2.onopen = (ev) => {
        //set up the user socket connections 
        sessions2.sessionManager.startPolling();

        const t = sessions2.generateSessionToken(userId2);
        sessions2.setSessionToken(userId2, t, true); //this also establishes the user's id on the server


        sessions2.sessionManager.createSession( //local session
          'session1',
          userId2,
          bufferRules,
          //{ password:'secret' } // sessionRules
        )

        // sessions1.messageRemoteSession(
        //   userId2, t,
        //   'startPolling'
        // )

        // sessions2.messageRemoteSession(
        //   userId2, t,  //user validation (so we can't spoof)
        //   'createSession',
        //   'session1',
        //   userId2,
        //   bufferRules,
        //   { password: 'secret' } // sessionRules
        // );

        sessions2.messageRemoteSession(
          userId2, t,  //user validation (so we can't spoof)
          'addUserToSession', 'session1', userId2, 'secret' //SessionManager.addUserToSession call
        );

      }

    });


  }


  createUser1()
  .then(() => { //will degrade performance to run two websockets sending/receiving at high rate unless you use web workers instead
    createUser2();
  })

}


testSessionService();