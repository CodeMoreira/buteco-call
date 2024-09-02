let room_id;
let getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia;
let localStream;
let remoteStream = {};
let screenStream;
let peers = [];
let peersAlreadyConnected = [];
let screenSharing = false;
let user_name = "";
let users = [];
let connections = [];

const addUserInDom = (user) => {
  document.getElementById(user)?.remove();

  let userDiv = document.createElement("div");
  userDiv.innerHTML = `<p>${user}</p>`;
  userDiv.className = "box";
  userDiv.id = user;
  document.getElementById("user-list").appendChild(userDiv);
};

const syncUsersInDom = () => {
  users.forEach((user) => {
    addUserInDom(user);
  });
};

const setLocalStream = (call, stream) => {
  remoteStream[call.peer] = stream;

  document.getElementById(call.peer)?.remove();

  const video = document.createElement("video");
  video.srcObject = stream;
  video.id = call.peer;
  video.autoplay = true;
  video.style.visibility = "hidden";
  video.style.position = "absolute";

  document.getElementById("screen-share-container").appendChild(video);
};

const toggleScreenSharingInDom = (id, sharing) => {
  const container = document.getElementById("screen-share-container");
  container.childNodes.forEach((child) => {
    if (child.id.includes(id) && sharing) {
      child.style.visibility = "visible";
      child.style.position = "relative";
      return;
    }

    child.style.visibility = "hidden";
    child.style.position = "absolute";
  });
};

const idExistsInConnections = (id) => {
  return peersAlreadyConnected.includes(id);
};

getUserMedia(
  { video: true, audio: true },
  (stream) => {
    localStream = stream;
  },
  (err) => {
    console.log(err);
  }
);

const peer = new Peer();

peer.on("open", (id) => {
  room_id = id;
});

window.onbeforeunload = () => {
  connections.forEach((conn) => {
    conn.send({ type: "close", id: conn.peer, name: user_name });
  });
  peer.destroy();
};

peer.on("connection", (conn) => {
  const userJustJoined = conn.metadata.name;
  notify(`O usuário <strong>${userJustJoined}</strong> entrou na sala.`);
  users.push(userJustJoined);
  connections.push(conn);

  syncUsersInDom();

  conn.on("open", () => {
    const connections = Object.entries(peer.connections);

    const filterConnIds = (userName) => {
      return connections
        .filter(
          ([_, innerConnArray]) => innerConnArray[0].metadata.name != userName
        )
        .map(([id]) => id);
    };

    connections.forEach(([_, innerConnArray]) => {
      innerConnArray.forEach((innerConn) => {
        if (!innerConn.send) {
          return;
        }

        const connectionsId = filterConnIds(innerConn.metadata.name);

        innerConn.send({
          type: "sync_connections",
          users,
          connectionsId,
        });
      });
    });

    conn.on("data", (data) => {
      if (data.type === "change_screen_share") {
        toggleScreenSharingInDom(data.screenSharingId, data.screenSharing);
      }

      if (data.type === "close") {
        // remove user from dom
        const index = users.indexOf(data.name);
        if (index > -1) {
          users.splice(index, 1);
          document.getElementById(data.id)?.remove();
          notify(`O usuário <strong>${data.name}</strong> saiu da sala.`);
        }

        syncUsersInDom();

        // remove from peersAlreadyConnected
        if (idExistsInConnections(data.id)) {
          peersAlreadyConnected = peersAlreadyConnected.filter(
            (id) => id !== data.id
          );
        }

        // destroy peer if the room is closed
        if (data.id === room_id) {
          peer.destroy();
        }

        // delete from connections
        connections = connections.filter((conn) => conn.peer !== data.id);

        // delete from peers
        peers = peers.filter((peer) => peer.id !== data.id);

        // remove video element
        document.getElementById(id)?.remove();
      }
    });
  });
});

peer.on("call", (call) => {
  call.answer(localStream);
  call.on("stream", (stream) => {
    setLocalStream(call, stream);
  });
  peers.push({ id: call.peer, call });
});

peer.on("error", function (err) {
  console.log("error", err);
});

const sendData = (data) => {
  connections.forEach((connection) => {
    console.log("sendData", connection);
    connection.send(data);
  });
};

const copyRoomId = () => {
  navigator.clipboard.writeText(room_id);
  notify("ID da sala copiado!");
};

const setUserName = () => {
  const name = document.getElementById("name-input").value;
  user_name = name;
};

function setScreenStream(stream) {
  let video = document.getElementById("screen-video");
  video.srcObject = stream;
  video.play();
}

function notify(msg) {
  let notification = document.getElementById("notification");
  let notificationText = document.getElementById("notification-text");
  notificationText.innerHTML = msg;
  notification.classList.remove("none");
  notification.classList.remove("hidden");
  notification.classList.add("visible");
  setTimeout(() => {
    notification.classList.remove("visible");
    notification.classList.add("hidden");
  }, 3000);
}

function hideModal() {
  const entryModal = document.getElementById("entry-modal");
  entryModal.style.display = "none";
}

function createRoom() {
  const name = document.getElementById("name-input").value;
  if (name == " " || name == "") {
    notify("Insira seu nome");
    return;
  }
  notify(`Sala criada com o id: ${room_id}.`);
  hideModal();
  user_name = `(Host) ${name}`;
  users.push(user_name);
  addUserInDom(user_name);
}

const connectAndCall = (id) => {
  const conn = peer.connect(room_id, { metadata: { name: user_name } });
  connections.push(conn);

  conn.on("open", () => {
    conn.on("data", (data) => {
      if (data.type === "change_screen_share") {
        toggleScreenSharingInDom(data.screenSharingId, data.screenSharing);
      }
      if (data.type == "sync_connections") {
        users = data.users;

        const lastUserJoined = users[users.length - 1];
        notify(`O usuário <strong>${lastUserJoined}</strong> entrou na sala.`);
        syncUsersInDom();

        if (data.connectionsId.length > 0) {
          data.connectionsId.forEach((connId) => {
            if (!idExistsInConnections(connId)) {
              connectAndCall(connId);
              peersAlreadyConnected.push(connId);
            }
          });
        }
      }
    });

    let call = peer.call(id, localStream);
    call.on("stream", (stream) => {
      setLocalStream(call, stream);
    });

    peers.push({ id, call });
  });
};

function joinRoom() {
  const name = document.getElementById("name-input").value;
  if (name == " " || name == "") {
    notify("Insira seu nome");
    return;
  }
  room_id = document.getElementById("room-input").value;
  if (room_id == " " || room_id == "") {
    alert("Insira o id da sala.");
    return;
  }

  hideModal();

  user_name = name;
  connectAndCall(room_id);
}

function startScreenShare() {
  if (screenSharing) {
    stopScreenSharing();
  }

  navigator.mediaDevices
    .getDisplayMedia({ video: { cursor: "always" } })
    .then((stream) => {
      screenStream = stream;
      let videoTrack = screenStream.getVideoTracks()[0];
      videoTrack.onended = () => {
        stopScreenSharing();
      };
      if (peer) {
        sendData({
          type: "change_screen_share",
          screenSharing: true,
          screenSharingId: peer.id,
        });
        peers.forEach(({ call: currentPeer }) => {
          let sender = currentPeer.peerConnection
            .getSenders()
            .find(function (s) {
              return s.track.kind == videoTrack.kind;
            });
          sender.replaceTrack(videoTrack);
        });

        screenSharing = true;
      }
    });
}

function stopScreenSharing() {
  if (!screenSharing) return;

  let videoTrack = screenStream.getVideoTracks()[0];
  if (peer) {
    sendData({
      type: "change_screen_share",
      screenSharing: false,
      screenSharingId: peer.id,
    });
    peers.forEach(({ call: currentPeer }) => {
      let sender = currentPeer.peerConnection.getSenders().find(function (s) {
        return s.track.kind == videoTrack.kind;
      });
      sender.replaceTrack(videoTrack);
    });
  }
  screenStream.getTracks().forEach(function (track) {
    track.stop();
  });

  screenSharing = false;
}

function toggleScreenSharing() {
  const button = document.getElementById("screen-share-button");

  if (!screenSharing) {
    startScreenShare();
    button.innerHTML = "Parar tela";
  } else {
    stopScreenSharing();
    button.innerHTML = "Compartilhar tela";
  }
}
