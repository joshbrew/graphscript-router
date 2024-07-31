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
          sessions1.messageRemoteSession(
            user._id as string, 
            'updateSessions',
            userUpdate, user._id, user.token, { session1: 'secret' }
          );
        },
        {
          [userId]: {
            send: (data) => {
              if (typeof data !== "string")
                data = JSON.stringify(data);
              ws.send(data);
            }
          }
        },
        false //local service doesn't need tokens
      );

      drawelem1.subscribeDrawHandler((detail) => {
        sessions1.sessionManager.updateBuffer('session1', { detail: detail });
      });

      sessions1.subscribe('receiveSessionData', (sessionData: any) => {
        if (sessionData.session1?.detail)
          drawelem2.replayActions(sessionData.session1.detail);
      });

      ws.onmessage = (ev) => {
        if (ev.data) {
          let data = JSON.parse(ev.data);
          if (data?.route) {
            sessions1.receive(data);
          }
        }
      }

      ws.onopen = (ev) => {
        sessions1.startPolling();

        const t = sessions1.generateSessionToken(userId);
        sessions1.setSessionToken(userId, t, true);

        sessions1.sessionManager.createSession(
          'session1',
          userId,
          t,
          bufferRules,
        );


        sessions1.messageRemoteSession(
          userId,
          'startPolling'
        );

        sessions1.messageRemoteSession(
          userId,
          'createSession',
          'session1',
          userId,
          t,
          bufferRules,
          { password: 'secret' }
        );

        sessions1.messageRemoteSession(
          userId,
          'addUserToSession',
          'session1',
          userId,
          t,
          'secret'
        );


        res(true);
      }
    });
  }


  const createUser2 = () => {
    return new Promise((res) => {
      // 2nd user, bidirectional communications 
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
          sessions2.messageRemoteSession(
            user._id as string, 
            'updateSessions', 
            userUpdate, user._id, user.token, { session1: 'secret' });
        },
        {
          [userId2]: {
            send: (data) => {
              if (typeof data !== "string")
                data = JSON.stringify(data);
              ws2.send(data);
            }
          }
        },
        false
      );

      ws2.onmessage = (ev) => {
        if (ev.data) {
          let data = JSON.parse(ev.data);
          if (data?.route) {
            sessions2.receive(data);
          }
        }
      }

      drawelem2.subscribeDrawHandler((detail2) => {
        sessions2.sessionManager.updateBuffer('session1', { detail2: detail2 });
      });

      sessions2.subscribe('receiveSessionData', (sessionData: any) => {
        if (sessionData.session1?.detail2)
          drawelem1.replayActions(sessionData.session1.detail2);
      });

      ws2.onopen = (ev) => {
        sessions2.startPolling();

        const t = sessions2.generateSessionToken(userId2);
        sessions2.setSessionToken(userId2, t, true);

        sessions2.sessionManager.createSession(
          'session1',
          userId2,
          t,
          bufferRules,
        );

        sessions2.messageRemoteSession(
          userId2,
          'addUserToSession',
          'session1',
          userId2,
          t,
          'secret'
        );

        res(true);
      }
    });
  }


  createUser1()
    .then(() => { //will degrade performance to run two websockets sending/receiving at high rate unless you use web workers instead
      createUser2();
    })

}


testSessionService();