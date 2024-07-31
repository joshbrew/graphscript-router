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


//SessionService instead of SessionManager and with bidirectional communication
export function testSessionService() {

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
        }//,
        //false //local service doesn't need tokens
      );

      drawelem1.subscribeDrawHandler((detail) => {
        sessions1.updateBuffer('session1', { detail: detail });
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

        sessions1.createSession(
          'session1',
          userId,
          bufferRules
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
          bufferRules,
          { password: 'secret' }, //online version can use a password
          t
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
        sessions2.updateBuffer('session1', { detail2: detail2 });
      });

      sessions2.subscribe('receiveSessionData', (sessionData: any) => {
        if (sessionData.session1?.detail2)
          drawelem1.replayActions(sessionData.session1.detail2);
      });

      ws2.onopen = (ev) => {
        sessions2.startPolling();

        const t = sessions2.generateSessionToken(userId2);
        sessions2.setSessionToken(userId2, t, true);

        sessions2.createSession(
          'session1',
          userId2,
          bufferRules,
          undefined
        );

        sessions2.messageRemoteSession(
          userId2,
          'addUserToSession',
          'session1',
          userId2,
          t,
          'secret',
        );

        res(true);
      }
    });
  }


  //note if using user 2, the canvas will be choppy unless we move something to web workers
  createUser1()
    .then(() => { //will degrade performance to run two websockets sending/receiving at high rate unless you use web workers instead
      createUser2();
    })

}


//testSessionService();