//hehe checke

mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));
const configuration = {
    iceServers: [{     // stun servers
        urls: [
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
            'stun:stun3.l.google.com:19302',
        ],
    },],
    iceCandidatePoolSize: 10,
};
let peerConnection = null;  // the primary peer connection
let localStream = null;    // stores the stream of caller
let remoteStream = null;  // store the stream of callee
let roomDialog = null;
let roomId = null;       // current room id
let localStreamSender = null;  // transmits local stream to other user
let remoteStreamSender = null; // screen share option 
let mediaRecorder = null;
let recordedBlobs = null;
let localScreenShare = null;  // local screen share option
let remoteScreenShare = null;

const senders = [];
const recordedVideo = document.querySelector('#recordedVideo');
const videooff = document.querySelector('#videooff');
const audiooff = document.querySelector('#audiooff');
const recordButton = document.querySelector('#startRecording');
const screenShare = document.getElementById('#screenShare');

//downloadButton for downloading the recorded file.
const downloadButton = document.querySelector('#downloadRecord');
recordButton.textContent = 'Start Recording'

// connects all buttons to their respective ids
function init() {
    document.querySelector('#cameraBtn').addEventListener('click', openCamera);
    document.querySelector('#mikeBtn').addEventListener('click', openMic);
    document.querySelector('#hangupBtn').addEventListener('click', hangUp);
    document.querySelector('#screenShare').addEventListener('click', screen_share);
    document.querySelector('#endscreenShare').addEventListener('click', end_screen_share);
    document.querySelector('#startRecording').addEventListener('click', screen_recording);
    document.querySelector('#downloadRecord').addEventListener('click', download_recording);;
    roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
}
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
document.querySelector('#localVideo').srcObject = stream;
localStream = stream;
document.querySelector('#hangupBtn').disabled = false;
document.querySelector('#startRecording').disabled = false;

// open camera function
// open the camera if it is closed
// closes it if it is open
function openCamera() {

    if (localStream == null) {
        console.log("no stream found")
        return;
    }
    var videoTracks = localStream.getVideoTracks();
    console.log("video change");
    for (var i = 0; i < videoTracks.length; ++i) {
        videoTracks[i].enabled = !videoTracks[i].enabled;
        if (!videoTracks[i].enabled) {
            document.getElementById("camImg").src = "img/cameraoff.png";
            // document.getElementById("cameraBtn").classList.add("blue");
        } else {
            document.getElementById("camImg").src = "img/cam.png";
            //document.getElementById("cameraBtn").classList.remove("blue");
        }
    }
}

// open mike function
// open the mike if it is closed
// closes it if it is open
function openMic() {
    if (localStream == null) {
        console.log("no stream found")
        return;
    }
    var audioTracks = localStream.getAudioTracks();
    console.log("Audio change");
    for (var i = 0; i < audioTracks.length; ++i) {
        audioTracks[i].enabled = !audioTracks[i].enabled;
        if (!audioTracks[i].enabled) {
            document.getElementById("micImg").src = "img/micoff.png";
            //document.getElementById("muteAudio").classList.add("blue");
        } else {
            document.getElementById("micImg").src = "img/mic.png";
            //document.getElementById("muteAudio").classList.remove("blue");
        }
    }
}

let globalroomid = "";  // global variable for room id

// creates the room for the caller
async function createRoom() {
    remoteStream = new MediaStream();  // demands for user media
    document.querySelector('#localVideo').srcObject = localStream;
    document.querySelector('#remoteVideo').srcObject = remoteStream;
    remoteStream = new MediaStream();
    document.querySelector('#localVideo').srcObject = localStream;
    document.querySelector('#remoteVideo').srcObject = remoteStream;
    const db = window.firebase.firestore();
    const roomRef = await db.collection('rooms').doc();
    console.log(roomRef, "roomref");
    console.log('Create PeerConnection with configuration: ', configuration);
    peerConnection = new RTCPeerConnection(configuration);

    registerPeerConnectionListeners();

    localStream.getTracks().forEach(track => {
        localStreamSender = peerConnection.addTrack(track, localStream);
        senders.push(localStreamSender);
    });


    // Code for collecting ICE candidates below
    const callerCandidatesCollection = roomRef.collection('callerCandidates');
    console.log(callerCandidatesCollection, "callerCandidatesCollection");
    peerConnection.addEventListener('icecandidate', event => {
        if (!event.candidate) {
            console.log('Got final candidate!');
            return;
        }
        console.log('Got candidate: ', event.candidate);
        callerCandidatesCollection.add(event.candidate.toJSON());
    });
    // Code for collecting ICE candidates above

    // Code for creating a room below
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('Created offer:', offer);

    const roomWithOffer = {
        'offer': {
            type: offer.type,
            sdp: offer.sdp,
        },
    };

    await roomRef.set(roomWithOffer);
    roomId = roomRef.id;
    openCamera();
    // document.getElementById("callPage").classList.add("disabled")
    let chat_button = document.getElementById("chatbutton");

    chat_button.click();
    console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);
    document.querySelector(
        '#currentRoom').innerText = `Current room is ${roomRef.id} - You are the caller!`;
    //alert(`Current room is ${roomRef.id} - You are the caller!`)
    
    // Code for creating a room above
    globalroomid = roomId;
    peerConnection.addEventListener('track', event => {
        console.log('Got remote track:', event.streams[0]);
        event.streams[0].getTracks().forEach(track => {
            console.log('Add a track to the remoteStream:', track);
            remoteStream.addTrack(track);
        });
    });


    if (!remoteStream) {
        document.querySelector('#remoteVideo').srcObject = null;
    }
    // Listening for remote session description below
    roomRef.onSnapshot(async snapshot => {
        const data = snapshot.data();
        if (!peerConnection.currentRemoteDescription && data && data.answer) {
            console.log('Got remote description: ', data.answer);
            const rtcSessionDescription = new RTCSessionDescription(data.answer);
            await peerConnection.setRemoteDescription(rtcSessionDescription);
        }
    });
    // Listening for remote session description above

    // Listen for remote ICE candidates below
    roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                let data = change.doc.data();
                console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                await peerConnection.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });
    // Listen for remote ICE candidates above
}
// enables the user to join the room with a custom room id
// makes a call to join room by id to establish the connection
function joinRoom() {
    console.log("abdakj");
    remoteStream = new MediaStream();
    document.querySelector('#localVideo').srcObject = localStream;
    document.querySelector('#remoteVideo').srcObject = remoteStream;
    document.querySelector('#confirmJoinBtn').addEventListener('click', async () => {
        roomId = document.querySelector('#room-id').value;
        console.log('Join room: ', roomId);
        document.querySelector(
            '#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;
        await joinRoomById(roomId);
    }, { once: true });
    roomDialog.open();
}

async function joinRoomById(roomId) {
    const db = window.firebase.firestore();
    const roomRef = db.collection('rooms').doc(`${roomId}`);
    const roomSnapshot = await roomRef.get();
    console.log('Got room:', roomSnapshot.exists);

    if (roomSnapshot.exists) {
        console.log('Create PeerConnection with configuration: ', configuration);
        peerConnection = new RTCPeerConnection(configuration);
        registerPeerConnectionListeners();
        localStream.getTracks().forEach(track => {
            localStreamSender = peerConnection.addTrack(track, localStream);  // adding the local steam to the connection
        });

        // Code for collecting ICE candidates below
        const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
        peerConnection.addEventListener('icecandidate', event => {
            if (!event.candidate) {
                console.log('Got final candidate!');
                return;
            }
            console.log('Got candidate: ', event.candidate);
            calleeCandidatesCollection.add(event.candidate.toJSON());
        });
        // Code for collecting ICE candidates above

        peerConnection.addEventListener('track', event => {   // accounting for tracks of the currrent user
            console.log('Got remote track:', event.streams[0]);
            event.streams[0].getTracks().forEach(track => {
                console.log('Add a track to the remoteStream:', track);
                remoteStream.addTrack(track);
            });
        });

        if (remoteStream == null) {
            document.querySelector('#remoteVideo').srcObject = null;
        }
        // Code for creating SDP answer below
        const offer = roomSnapshot.data().offer;
        console.log('Got offer:', offer);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        console.log('Created answer:', answer);
        await peerConnection.setLocalDescription(answer);

        const roomWithAnswer = {
            answer: {
                type: answer.type,
                sdp: answer.sdp,
            },
        };
        await roomRef.update(roomWithAnswer);
        // Code for creating SDP answer above

        // Listening for remote ICE candidates below
        roomRef.collection('callerCandidates').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(async change => {
                if (change.type === 'added') {
                    let data = change.doc.data();
                    console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data));
                }
            });
        });
        document.getElementById("callPage").classList.remove("disabled");
        document.getElementById("room_creation").classList.add("disabled");
        // Listening for remote ICE candidates above
    }
}

// opens the front page
async function openPage(e) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.querySelector('#localroomVideo').srcObject = stream;
    localStream = stream;
}
// function to request the user media
async function openUserMedia(e) {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.querySelector('#localVideo').srcObject = stream;
    localStream = stream;
    remoteStream = new MediaStream();
    document.querySelector('#remoteVideo').srcObject = remoteStream;

    console.log('Stream:', document.querySelector('#localVideo').srcObject);
    document.querySelector('#cameraBtn').disabled = true;
    document.querySelector('#hangupBtn').disabled = false;
    // document.querySelector('#screenShare').disabled = false;
    document.querySelector('#startRecording').disabled = false;
    // videooff.disabled=false;
    // audiooff.disabled=false;
    getSupportedMimeTypes().forEach(mimeType => {
        const option = document.createElement('option');
        option.value = mimeType;
        option.innerText = option.value;
        codecPreferences.appendChild(option);
    });
    codecPreferences.disabled = false;
}

// code for hang up functionality
async function hangUp(e) {
    const tracks = document.querySelector('#localVideo').srcObject.getTracks();
    tracks.forEach(track => {
        track.stop();
    });
    // close remote stream if active
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
    }
    // close the connection if active
    if (peerConnection) {
        peerConnection.close();
    }

    document.querySelector('#localVideo').srcObject = null;
    document.querySelector('#remoteVideo').srcObject = null;
    document.querySelector('#cameraBtn').disabled = false;
    document.querySelector('#hangupBtn').disabled = true;
    document.querySelector('#currentRoom').innerText = '';
    //document.querySelector('#screenShare').disabled = true;

    // Delete room on hangup
    if (roomId) {
        const db = window.firebase.firestore();
        const roomRef = db.collection('rooms').doc(roomId);
        const calleeCandidates = await roomRef.collection('calleeCandidates').get();
        calleeCandidates.forEach(async candidate => {
            await candidate.ref.delete();
        });
        const callerCandidates = await roomRef.collection('callerCandidates').get();
        callerCandidates.forEach(async candidate => {
            await candidate.ref.delete();
        });
        await roomRef.delete();
    }

    document.location.reload(true);
}

function registerPeerConnectionListeners() {
    peerConnection.addEventListener('icegatheringstatechange', () => {
        console.log(
            `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
    });

    peerConnection.addEventListener('connectionstatechange', () => {
        console.log(`Connection state change: ${peerConnection.connectionState}`);
    });

    peerConnection.addEventListener('signalingstatechange', () => {
        console.log(`Signaling state change: ${peerConnection.signalingState}`);
    });

    peerConnection.addEventListener('iceconnectionstatechange ', () => {
        console.log(
            `ICE connection state change: ${peerConnection.iceConnectionState}`);
    });
}
// const senders = [];
// screen share start
function handleSuccess(stream) {
    //document.querySelector('#screenShare').disabled = true;
    const video = document.querySelector('#screenVideo');
    video.srcObject = stream;
    localScreenShare = stream;
    document.querySelector('#remotescreenVideo').srcObject = remoteScreenShare;
    // demonstrates how to detect that the user has stopped
    // sharing the screen via the browser UI.
    stream.getVideoTracks()[0].addEventListener('ended', () => {
        document.querySelector('#screenShare').disabled = false;
    });
}

// function to enable screen share
async function screen_share() {
    // replaces user camera video with screen in tracks
    const localscreenshare = await navigator.mediaDevices.getDisplayMedia({ video: true });
    senders.find(sender => sender.track.kind === 'video').replaceTrack(localscreenshare.getTracks()[0]);
    document.querySelector('#localVideo').srcObject = localscreenshare;

};

// ends screen share
async function end_screen_share() {
    // replace the track again
    senders.find(sender => sender.track.kind === 'video').replaceTrack(localStream.getTracks().find(track => track.kind === 'video'));
    document.querySelector('#localVideo').srcObject = localStream;
};

// for record functionality
async function screen_recording() {
    if (recordButton.textContent === 'Start Recording') {
        Recordingstart();
    } else {
        stopRecording();
        recordButton.textContent = 'Start Recording';
        downloadButton.disabled = false;
        codecPreferences.disabled = false;
    }
};


//function for downloading the recorded files 
async function download_recording() {
    const blob = new Blob(recordedBlobs, { type: 'video/webm' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'test.webm';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
};

function handleDataAvailable(event) {
    console.log('handleDataAvailable', event);
    if (event.data && event.data.size > 0) {
        recordedBlobs.push(event.data);
    }
}

function getSupportedMimeTypes() {
    const possibleTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/mp4;codecs=h264,aac',
    ];
    return possibleTypes.filter(mimeType => {
        return MediaRecorder.isTypeSupported(mimeType);
    });
}

// 
async function Recordingstart() {
    recordedBlobs = [];
    const mimeType = codecPreferences.options[codecPreferences.selectedIndex].value;
    const options = { mimeType };

    const recordedStream = await navigator.mediaDevices.getDisplayMedia({ video: { mediaSource: "screen" }, audio: true });
    mediaRecorder = new MediaRecorder(recordedStream, options);
    

    console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
    recordButton.textContent = 'Stop Recording';
    downloadButton.disabled = true;
    codecPreferences.disabled = true;
    mediaRecorder.onstop = (event) => {
        console.log('Recorder stopped: ', event);
        console.log('Recorded Blobs: ', recordedBlobs);
    };
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.start();
    console.log('MediaRecorder started', mediaRecorder);
}

function stopRecording() {
    mediaRecorder.stop();
}

//adding the functionality for chat
let user = ""
async function myFun() {
    openPage();
    getSupportedMimeTypes().forEach(mimeType => {
        const option = document.createElement('option');
        option.value = mimeType;
        option.innerText = option.value;
        codecPreferences.appendChild(option);
    });
    codecPreferences.disabled = false;
    document.querySelector('#create__room').addEventListener('click', () => {
        init();
        console.log(user);
        //createRoom();
        //call_code();
        if(user!="")
        {
            createRoom();
            call_code();
        }
        else
        {
            alert("Please sign in to continue!")
        }
    });
    roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
    document.querySelector('#join__room').addEventListener('click', () => {
        init();
        if(user!="")
        {
            joinRoom();
        }
        else
        {
            alert("Please sign in to continue!")
        }
        
    });
}

function call_code() {
    document.getElementById("callPage").classList.remove("disabled");
    document.getElementById("room_creation").classList.add("disabled");
}

const config = {
    apiKey: "AIzaSyCkDXJe-PkH9uzDc_RA0OH4e7m9Ldrfmfg",
    authDomain: "msteams-4eaa4.firebaseapp.com",
    databaseURL: "https://msteams-4eaa4-default-rtdb.firebaseio.com",
    projectId: "msteams-4eaa4",
    storageBucket: "msteams-4eaa4.appspot.com",
    messagingSenderId: "96003843721",
    appId: "1:96003843721:web:1445758b3ed18b692f8858",
    measurementId: "G-CZCJV5C9Y8"
};

// sign in with google
function signin() {
    firebase.initializeApp(config);
    const provider=new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);  // popup for signin
    user=firebase.auth().currentUser;
    console.log('done');
    alert(`Sign in successful. You can continue!`);
}
myFun();
document.querySelector('#signin').addEventListener('click', () => {
    signin();
});



let email = "";



let db;
let msgRef;
// begin chat on clicking chat button
function initChat(){
    db = firebase.database();
    msgRef = db.ref("/msgs"); 
    //to store data in the msgs folder by creating a reference in database

    // const name=firebase.auth().currentUser.displayName;
    msgRef.on('child_added', updateMsgs);
    document.querySelector('#msg-btn').addEventListener('click',sendMessage);
}

// log out of the chat
function logOut(){
    firebase.auth().signOut().then(function() {
        console.log("SIGN OUT");
        window.location.replace("login.html");
      }).catch(function(error) {

        console.error(error);
      });
}

// update messages in the chat window
const updateMsgs = data =>{
  const {email: userEmail , name, text} = data.val();
    console.log(firebase.auth().currentUser);
  
  var outputText = text;
  
  
    outputText = normalEncrypt(outputText);
  
    const msgScreen = document.getElementById("messages"); //the <ul> that displays all the <li> msgs
    console.log("hehe",name);
  //load messages
  let msg;
  if(firebase.auth().currentUser.email == userEmail)
  {
    msg = `<li class= "msg my"><span class = "msg-span">
    <p>You: </p><p>${outputText}</p>
    </span>
  </li>`
  }
  else
  {
    msg = `<li class= "msg"><span class = "msg-span">
    <p><i class = "name">${name}: </i></p><p>${outputText}</p>
    </span>
  </li>`
  }
  msgScreen.innerHTML += msg;
  document.getElementById("chat-window").scrollTop = document.getElementById("chat-window").scrollHeight;
  //auto scroll to bottom
}

document.getElementById("chatbutton").addEventListener('click',showChat);
// shows the main chat window
function showChat(){
    console.log("abuiiiiii")
    document.getElementById("chat").classList.remove("disabled")
    document.getElementById("callPage").classList.add("disabled")
    document.getElementById("chat-window").classList.remove("disabled");
    document.getElementById("go_back").classList.remove("disabled");
    initChat();
}

// close the chat and go ack to the call
document.getElementById("go_back").addEventListener('click',hideChat);
function hideChat(){
    console.log("hehe")
    document.getElementById("chat").classList.add("disabled")
    document.getElementById("callPage").classList.remove("disabled")
    document.getElementById("chat-window").classList.add("disabled");
    document.getElementById("go_back").classList.add("disabled");
}
// send message in the chat
function sendMessage(e){
    console.log("hi")
    e.preventDefault();
    const msgInput = document.getElementById("msg-input"); //the input element to write messages

    const text = msgInput.value;
    console.log(text);
    const user=firebase.auth().currentUser
    if(!text.trim()) return alert('Please type your message.'); //no msg submitted
    const msg = {
        email:user.email,
        name:user.displayName,
        text: text
    };

    msgRef.push(msg);
    msgInput.value = "";
}

function normalEncrypt(text){
    var words = text.replace(/[\r\n]/g, '').toLowerCase().split(' ');
    var newWord = '';
    var newArr =[];
  
    words.map(function(w) {
      if(w.length > 1){
        var lastIndex = w.length-1;
        var lastLetter = w[lastIndex];
  
        //add the first letter
        newWord += w[0];
        w = w.slice(1,lastIndex);
  
        //scramble only letters in between the first and last letter
        w.split('').map(function(x) { 
            var hash = Math.floor(Math.random() * w.length);
            newWord += w[hash];
            w = w.replace(w.charAt(hash), '');
        });
  
        //add the last letter
        newWord+=lastLetter;
        newArr.push(newWord);
        newWord = '';
      }else{
        newArr.push(w);
      }
    });
    text = newArr.join(' ');
    return text;
  }

// promt on ck=licking the invite friend button
document.getElementById("invite_button").addEventListener('click', popup_id);
function popup_id(){
    prompt("The room ID is: ",globalroomid);
}

document.getElementById("callPage").classList.add("disabled");
