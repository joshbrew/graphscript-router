import { StreamServer } from './streams';
import { CanvasWithControls, DrawEventData } from '../../../../examples/sessions/src/CanvasWithControls';
import '../../../../examples/sessions/src/CanvasWithControls';

const streamServer = new StreamServer(10, 10);

const userIds = ['user1', 'user2'];

// Adding users
userIds.forEach(userId => streamServer.addUser(userId));

// User1 creates a session and becomes the owner and admin
const streamId = streamServer.createSession('user1', {
  name: 'streamSession',
  sessionUserProps: { drawUpdate: true, drawState: true },
  hostProps: { drawUpdate: true, drawState: true },
  password: 'securepass', // Example password
  maxUsers: 5, // Maximum number of users in the session
});

const sharedId = streamServer.createSession('user1', {
  name: 'sharedSession',
  sessionUserProps: { drawUpdate: true, drawState: true },
  maxUsers: 10, // Maximum number of users in the session
});

const sharedId2 = streamServer.createSession('user1', {
  name: 'sharedSession2',
  sessionUserProps: { drawUpdate: true, drawState: true },
  maxUsers: 10, // Maximum number of users in the session
});

const drawelem1 = document.createElement('canvas-with-controls') as CanvasWithControls;
const drawelem2 = document.createElement('canvas-with-controls') as CanvasWithControls;

document.body.appendChild(drawelem1);
document.body.appendChild(drawelem2);

drawelem1.subscribeDrawHandler((detail: DrawEventData) => {
  streamServer.updateUserProperties('user1', { drawUpdate: [detail], drawState: detail }, false, true);
});

drawelem2.subscribeDrawHandler((detail: DrawEventData) => {
  streamServer.updateUserProperties('user2', { drawUpdate: [detail], drawState: detail }, false, true);
});

// Function to handle subscription with proper onmessage callbacks
function subscribeUser(userId, sessionId, password) {
  const onmessage = (session, data) => {
    if (data.drawUpdate) {
      if (userId === 'user1') {
        drawelem1.replayActions(data.drawUpdate);
      } else if (userId === 'user2') {
        drawelem2.replayActions(data.drawUpdate);
      }
    }
  };

  const onclose = () => {
    streamServer.localUnsubscribe(userId, sessionId);
  };

  streamServer.subscribe(userId, sessionId, password, onmessage, onclose);
}

// Function to unsubscribe from all sessions
function unsubscribeFromAllSessions(userId) {
  const currentSessions = Object.keys(streamServer.users[userId].sessions);
  currentSessions.forEach(currentSessionId => {
    streamServer.unsubscribe(userId, currentSessionId);
  });
}

// Subscribe both users to the first session (streamSession)
subscribeUser('user1', streamId, 'securepass');
subscribeUser('user2', streamId, 'securepass');

// Ban user2 from the sharedSession
streamServer.banUser('user1', 'user2', sharedId);

// Function to render the session browser table
function renderSessionBrowser(userId) {
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

  const sessions = streamServer.listSessions();
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
    const isJoined = !!streamServer.users[userId].sessions[session.sessionId];
    joinButton.innerText = isJoined ? 'Leave' : 'Join';
    joinButton.onclick = () => {
      if (isJoined) {
        streamServer.unsubscribe(userId, session.sessionId);
        alert('Left session successfully!');
      } else {
        const password = streamServer.hasPassword(session.sessionId) ? prompt('Enter session password (if any):') : undefined;
        try {
          unsubscribeFromAllSessions(userId);
          subscribeUser(userId, session.sessionId, password);
          alert('Joined session successfully!');
        } catch (error) {
          alert(`Error: ${error.message}`);
        }
      }
      sessionBrowser.innerHTML = ''; // Clear the current table
      sessionBrowser.appendChild(renderSessionBrowser(userId)); // Refresh the session browser
    };
    actionCell.appendChild(joinButton);
    row.appendChild(actionCell);

    sessionTable.appendChild(row);
  });

  sessionBrowser.appendChild(sessionTable);

  const createSessionButton = document.createElement('button');
  createSessionButton.innerText = 'Create Session';
  createSessionButton.onclick = () => {
    const name = prompt('Enter session name:');
    const password = prompt('Enter session password (if any):');
    const maxUsers = parseInt(prompt('Enter maximum number of users:') || '0', 10);
    streamServer.createSession(userId, {
      name,
      sessionUserProps: { drawUpdate: true, drawState: true },
      password,
      maxUsers,
    });
    alert('Session created successfully!');
    sessionBrowser.innerHTML = ''; // Clear the current table
    sessionBrowser.appendChild(renderSessionBrowser(userId)); // Refresh the session browser
  };
  sessionBrowser.appendChild(createSessionButton);

  return sessionBrowser;
}

// Render the session browsers next to each user's canvas
document.body.appendChild(renderSessionBrowser('user1'));
document.body.appendChild(renderSessionBrowser('user2'));

// Set user2 as the host for the streamSession
streamServer.setHost(streamId, 'user2');

// Swap admin from user1 to user2
streamServer.setAdmin(streamId, 'user1', 'user2');

// Attempt to join as a banned user
try {
  streamServer.subscribe('user2', sharedId);
} catch (error) {
  console.log(`Error: ${error.message}`);
}

// Start polling and pushing updates
// setInterval(() => streamServer.pushUpdates(), 10); // Push updates every 10ms
// setInterval(() => streamServer.pollSubscribers(), 10); // Poll subscribers every 10ms
