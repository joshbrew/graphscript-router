import {
  InputBuffer, CircularBuffer, DelayBuffer, DelayBufferManager,
} from '../../src/services/sessions/buffers'
import {
  testDelayBuffers,testDelayBufferManagers, testSessionManagers, testCombinedManagers
}  from '../../src/services/sessions/tests'
import { CanvasWithControls } from './src/CanvasWithControls';
import './src/CanvasWithControls'



// Example usage

import './index.css'

//testDelayBuffers();
//testDelayBufferManager();
//testSessionManager();
//testCombinedManagers();

const drawelem1 = document.createElement('canvas-with-controls') as CanvasWithControls; //associate with user 1 
const drawelem2 = document.createElement('canvas-with-controls') as CanvasWithControls; //associate with user 2

document.body.appendChild(drawelem1);
document.body.appendChild(drawelem2);

export const testCombinedManagersWithWebSocket = () => {
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
          if(message.data.user2.session1?.detail) {
            drawelem2.replayActions(message.data.user2.session1.detail)
          }
      }

      if(message.route === 'stopPolling') {
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
                detail:'inpbuf'
            }, // delayBufferRules
            { password:'secret' } // sessionRules
        ]
    }));

    ws.send(JSON.stringify({
        route: 'addUser',
        args: ['session1', 'user2', 'secret'] // sessionId, userId, password
    }));

    ws.send(JSON.stringify({
        route:'startPolling'
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
      detail:'inpbuf'
    }
  );

  delayBufferManager1.onupdate = (aggregatedBuffer) => {
    console.log('Aggregated Buffer from Manager1 updated:', aggregatedBuffer);
    if (aggregatedBuffer['session1']) {
        ws.send(JSON.stringify({ route: 'updateBuffer', args: ['session1', aggregatedBuffer['session1'], 'admin'] }));
    }
  };

  let interval;
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
    delayBufferManager1.updateBuffer('session1', {detail:detail});
  })


};

testCombinedManagersWithWebSocket();