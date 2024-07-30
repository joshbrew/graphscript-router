import { StreamServer } from './streams';
import { CanvasWithControls, DrawEventData } from '../../../../examples/sessions/src/CanvasWithControls';
import '../../../../examples/sessions/src/CanvasWithControls';

const user1Session = new WebSocket('ws://localhost:8080');
const user2Session = new WebSocket('ws://localhost:8080');

const drawelem1 = document.createElement('canvas-with-controls') as CanvasWithControls;
const drawelem2 = document.createElement('canvas-with-controls') as CanvasWithControls;

document.body.appendChild(drawelem1);
document.body.appendChild(drawelem2);

const user1Client = new StreamServer(0, 10);
const user2Client = new StreamServer(0, 10);

user1Session.onopen = () => {
    user1Client.addUser('user1', message => user1Session.send(JSON.stringify(message)), true);
    user1Client.createSession('user1', {
      sessionId: 'session-1',
      name: 'streamSession',
      maxUsers: 5,
      password: 'securepass'
    }, true);
    setTimeout(() => {
      user1Client.subscribe('user1', 'session-1', 'securepass', (session, data) => {
        console.log('user1 received update:', data);
        if (data.drawUpdate) {
          drawelem1.replayActions(data.drawUpdate);
        }
      }, true);
    }, 1000); // Adjust delay as necessary
  };
  
  user2Session.onopen = () => {
    user2Client.addUser('user2', message => user2Session.send(JSON.stringify(message)), true);
    setTimeout(() => {
      user2Client.subscribe('user2', 'session-1', 'securepass', (session, data) => {
        console.log('user2 received update:', data);
        if (data.drawUpdate) {
          drawelem2.replayActions(data.drawUpdate);
        }
      }, true);
    }, 2000); // Ensure this delay is longer than the session creation delay
  };
  
  user1Session.addEventListener('message', (event) => {
    const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    console.log('user1msg', message); // Already present, ensure it remains
    if (user1Client[message.route]) {
      if (message.args) user1Client[message.route](...message.args);
    }
  });
  
  user2Session.addEventListener('message', (event) => {
    const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    console.log('user2msg', message); // Already present, ensure it remains
    if (user2Client[message.route]) {
      if (message.args) user2Client[message.route](...message.args);
    }
  });

drawelem1.subscribeDrawHandler((detail: DrawEventData) => {
  user1Client.updateUserProperties('user1', { drawUpdate: [detail], drawState: detail }, false, true);
});

drawelem2.subscribeDrawHandler((detail: DrawEventData) => {
  user2Client.updateUserProperties('user2', { drawUpdate: [detail], drawState: detail }, false, true);
});

// Function to render the session browser table
function renderSessionBrowser(userClient, userSession) {
  const sessionBrowser = document.createElement('div');
  const sessionTable = document.createElement('table');
  const headerRow = document.createElement('tr');

  const headers = ['Session ID', 'Name', 'User Count', 'Max Users', 'Action'];
  headers.forEach(headerText => {
    const header = document.createElement('th');
    header.innerText = headerText;
    headerRow.appendChild(header);
  });
  sessionTable.appendChild(headerRow);

  userClient.listSessions(userClient.userId);

  const onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.route === 'listSessions') {
        userSession.removeEventListener('message',onmessage);
      const sessions = message.args[0];
      sessions.forEach(session => {
        const row = document.createElement('tr');

        const sessionIdCell = document.createElement('td');
        sessionIdCell.innerText = session.sessionId;
        row.appendChild(sessionIdCell);

        const nameCell = document.createElement('td');
        nameCell.innerText = session.name;
        row.appendChild(nameCell);

        const userCountCell = document.createElement('td');
        userCountCell.innerText = session.userCount.toString();
        row.appendChild(userCountCell);

        const maxUsersCell = document.createElement('td');
        maxUsersCell.innerText = session.maxUsers.toString();
        row.appendChild(maxUsersCell);

        const actionCell = document.createElement('td');
        const joinButton = document.createElement('button');
        joinButton.innerText = 'Join';
        joinButton.onclick = () => {
          const password = session.hasPassword ? prompt('Enter session password (if any):') : undefined;
          userClient.subscribe(userClient.userId, session.sessionId, password, (session, data) => {
            if (data.drawUpdate) {
              if (userClient.userId === 'user1') {
                drawelem1.replayActions(data.drawUpdate);
              } else if (userClient.userId === 'user2') {
                drawelem2.replayActions(data.drawUpdate);
              }
            }
          }, true);
          alert('Joined session successfully!');
        };
        actionCell.appendChild(joinButton);
        row.appendChild(actionCell);

        sessionTable.appendChild(row);
      });
    }
  }

  userSession.addEventListener('message',onmessage);

  sessionBrowser.appendChild(sessionTable);

  const createSessionButton = document.createElement('button');
  createSessionButton.innerText = 'Create Session';
  createSessionButton.onclick = () => {
    const name = prompt('Enter session name:');
    const password = prompt('Enter session password (if any):');
    const maxUsers = parseInt(prompt('Enter maximum number of users:') || '0', 10);
    userClient.createSession(userClient.userId, {
      name,
      sessionUserProps: { drawUpdate: true, drawState: true },
      password,
      maxUsers,
    }, true);
    alert('Session created successfully!');
  };
  sessionBrowser.appendChild(createSessionButton);

  return sessionBrowser;
}

// Render the session browsers next to each user's canvas
document.body.appendChild(renderSessionBrowser(user1Client, user1Session));
document.body.appendChild(renderSessionBrowser(user2Client, user2Session));
