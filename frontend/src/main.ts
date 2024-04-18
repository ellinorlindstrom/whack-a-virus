import { io, Socket } from "socket.io-client";
import {
  ClientToServerEvents,
  RoomCreatedEvent,
  ScoreUpdateEvent,
  ServerToClientEvents,
} from "@shared/types/SocketTypes";
import "./assets/scss/style.scss";

const SOCKET_HOST = import.meta.env.VITE_SOCKET_HOST;

// virus display
const gridItems = document.querySelectorAll(
  ".grid-item"
) as NodeListOf<Element>;
const displayBoxEl = document.querySelector("#app") as HTMLDivElement;

// display or no-display
const startPageEl = document.querySelector("#startPage") as HTMLElement;
const lobbyPageEl = document.querySelector("#lobbyPage") as HTMLElement;
const countdownPageEl = document.querySelector(
  "#countdownPage"
) as HTMLDivElement;
const countdownTimerEl = document.getElementById(
  "countdownTimer"
) as HTMLDivElement;
const gamePageEl = document.querySelector("#gamePage") as HTMLElement;

// start game display
const startPageFormEl = document.querySelector(
  ".startPageForm"
) as HTMLFormElement;
const usernameInputEl = document.querySelector(
  "#usernameInput"
) as HTMLInputElement;
const gameFieldEl = document.querySelector(".game-field") as HTMLDivElement;
const gameOverPageEl = document.querySelector(
  "#game-over-page"
) as HTMLDivElement;
const startNewGameFormEl = document.querySelector(
  "#startNewGameForm"
) as HTMLFormElement;

// Result display
const player1pEl = document.querySelector("#player1p") as HTMLParagraphElement;
const player2pEl = document.querySelector("#player2p") as HTMLParagraphElement;
const player1TimerEl = document.querySelector(
  "#player1Timer"
) as HTMLParagraphElement;
const player2TimerEl = document.querySelector(
  "#player2Timer"
) as HTMLParagraphElement;
const highscoreChartEl = document.querySelector(
  ".highscoreChart"
) as HTMLUListElement;
const gamesEl = document.querySelector(
  ".games"
) as HTMLUListElement;

// Connect to Socket.IO Server
const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
  io(SOCKET_HOST);

player1TimerEl.innerText = `00:000`;
player2TimerEl.innerText = `00:000`;

let timerIntervalPlayer1: ReturnType<typeof setInterval>;
let timerIntervalPlayer2: ReturnType<typeof setInterval>;
let startTimePlayer: number;

const timer = (timerElement: HTMLElement, startTime: number) => {
  const currentTime = Date.now();
  const passedTime = currentTime - startTime;
  

  const seconds = Math.floor((passedTime % 60000) / 1000);
  const milliseconds = passedTime % 1000;

  const updatedTime = `${seconds.toString()}:${milliseconds
    .toString()
    .padStart(3, "0")}`;

  timerElement.innerHTML = `${updatedTime}`;

  if (seconds >= 30) {
    clearInterval(timerIntervalPlayer1);
    if (socket.id) {
      stopTimer(socket.id);
    }
  }
};

const startTimer = (playerNumber: string) => {
  if (playerNumber === socket.id) {
    startTimePlayer = Date.now();
    timerIntervalPlayer1 = setInterval(
      () => timer(player1TimerEl, startTimePlayer),
      100
    );
  }
};

const stopTimer = (playerNumber: string) => {
  const elapsedTime = Date.now() - startTimePlayer;

  if (playerNumber === socket.id) {
    clearInterval(timerIntervalPlayer1);

    console.log("elapsedTime: ", elapsedTime);

    socket.emit("virusClick", {
      playerId: socket.id,
      elapsedTime: elapsedTime,
    });
  } else {
    clearInterval(timerIntervalPlayer2);
  }
};

// Show waiting room
const showWaitingRoom = () => {
  startPageEl.classList.add("hide");
  lobbyPageEl.classList.remove("hide");
};

// Show game
const showGameRoom = () => {
  gamePageEl.classList.remove("hide");
  lobbyPageEl.classList.add("hide");
};

// Show player that the other player left
const showDisconnect = () => {

  // startPageEl.classList.add("hide");
  gamePageEl.classList.add("hide");
  displayBoxEl.classList.remove("hide");

  // create a DIV element
  const displayEl = document.createElement("div");

  // Set class of that element
  displayEl.classList.add("displayDisconnect");

  // Set content of the DIV element
  displayEl.innerHTML = `
	<h3 id="headerNoob">The other player was a noob!</h3>
  <p id="paraNoob">And left you hanging!</p>
	<figure id="figureNoob">
	<iframe src="https://giphy.com/embed/2kcrRowOHeH9n1EBx6" width="480" height="480" frameBorder="0" class="giphy-embed" id="giphyNoob" allowFullScreen></iframe>
	</figure>
  <form id="startNewGameForm">
  <button id="startGame-submit" type="submit">Play again!</button>
  </form>
	`;

  // Append the DIV element to the page
  displayBoxEl.appendChild(displayEl);
};

// insert usersnames to results
const usernamesDisplay = (username: string, opponent: string) => {
  const player1 = document.querySelector("#player1") as HTMLHeadingElement;
  const player2 = document.querySelector("#player2") as HTMLHeadingElement;

  player1.innerText = `${username}`;
  player2.innerText = opponent || "Opponent";
};

const updateScoreUI = (playerId: string, score: number) => {
  if (playerId !== socket.id) {
    player1pEl.innerHTML = `Points: ${score}`;
  } else {
    player2pEl.innerHTML = `Points: ${score}`;
  }

  console.log("playerId", playerId);
  console.log("score", score);
};

// Listen for when connection is established
socket.on("connect", () => {
  console.log("💥 Connected to the server", SOCKET_HOST);
  console.log("🔗 Socket ID:", socket.id);
});

// Listen for when server got tired of us
socket.on("disconnect", () => {
  console.log("💀 Disconnected from the server:", SOCKET_HOST);
});

// Listen for when we're reconnected (either due to our or the servers connection)
socket.io.on("reconnect", () => {
  console.log("🍽️ Reconnected to the server:", SOCKET_HOST);
  console.log("🔗 Socket ID:", socket.id);
});

socket.emit("highscore", (highscores) => {
  highscoreChartEl.innerHTML = highscores
    .slice(0, 5)
    .map(
      (highscore) => `<li>${highscore.username}: ${highscore.highscore}</li>`
    )
    .join("");
});

socket.emit("results", (allResults) => {
  gamesEl.innerHTML = allResults
    .slice(0, 10)
    .map(
      (result) =>
        `<li>${result.player1} ${result.player1Score} – ${result.player2Score} ${result.player2} </li>`
    )
    .join("");
});

socket.on("scoreUpdate", ({ playerId, score }) => {
  updateScoreUI(playerId, score);
});

socket.on("playerLeft", () => {
  showDisconnect();
});

if (startNewGameFormEl) {
  startNewGameFormEl.addEventListener("submit", (e) => {
    e.preventDefault();

    showWaitingRoom();

    player1TimerEl.innerText = `00:000`;
    player2TimerEl.innerText = `00:000`;
    player1pEl.innerHTML = `Points: 0`;
    player2pEl.innerHTML = `Points: 0`;

    if (username) {
      socket.emit("playerJoinRequest", username);
    }
  });
}

// Create varible for username
let username: string | null = null;

// add eventlistner listening for when the form-username is submitted
startPageFormEl.addEventListener("submit", (e) => {
  e.preventDefault();

  // Trim the input-value
  const trimmedUsername = usernameInputEl.value.trim();

  // If no username is written
  if (!trimmedUsername) {
    return;
  }

  // set username
  username = trimmedUsername;

  // Emit `playerJoinRequest`-event to the server and wait for acknowledgement
  socket.emit("playerJoinRequest", username);

  // function to display the waiting-lobby
  showWaitingRoom();

  socket.on("roomCreated", (event: RoomCreatedEvent) => {
    const opponent = event.players.find(
      (player) => player.username !== username
    )?.username;

    // function to display the game-room
    showGameRoom();

    if (username && opponent) {
      usernamesDisplay(username, opponent);
    }
  });

  socket.on("waitingForPlayer", () => {});
});

socket.on("countdown", (seconds) => {
  if (seconds > 0) {
    countdownPageEl.style.display = "flex";
    countdownTimerEl.innerHTML = `Game starts in </br> ${seconds}`;
  } else {
    countdownTimerEl.innerHTML = "Goo!";
  }
});

socket.on("startGame", () => {
  countdownPageEl.style.display = "none";
  gameFieldEl.style.display = "flex";
});

socket.on("opponentReactionTime", (playerId: string, elapsedTime: number) => {
  if (playerId !== socket.id) {
    const seconds = Math.floor(elapsedTime / 1000);
    const milliseconds = elapsedTime % 1000;
    player2TimerEl.innerText = `${seconds
      .toString()
      .padStart(2, "0")}:${milliseconds.toString().padStart(3, "0")}`;
  }
});

socket.on("virusLogic", (position, delay) => {
  // Remove "virus" class from all grid items
  setTimeout(() => {
    gridItems.forEach((item) => {
      item.classList.remove("virus");
    });

    // Add "virus" class to the new position
    const newPosition = Number(position);
    if (
      !isNaN(newPosition) &&
      newPosition >= 0 &&
      newPosition < gridItems.length
    ) {
      gridItems[newPosition].classList.add("virus");
      if (socket.id && username) {
        startTimer(socket.id);
      }
    }
  }, delay);
});

//Add event listener to each grid item to remove virus on click.
gridItems.forEach((gridItem) => {
  gridItem.addEventListener("click", () => {
    if (gridItem.classList.contains("virus")) {
      gridItem.classList.remove("virus");
      if (username && socket.id) {
        stopTimer(socket.id);
      }
    }
  });
});

let playerScores: Record<string, number> = {};

socket.on("scoreUpdate", (event: ScoreUpdateEvent) => {
  console.log(`Player ID: ${event.playerId} scored ${event.score} points`);

  playerScores[event.playerId] = event.score;

  const currentPlayerId = socket.id;

  const playerOnePoints = document.querySelector(
    "#player-one-points"
  ) as HTMLParagraphElement;
  const playerTwoPoints = document.querySelector(
    "#player-two-points"
  ) as HTMLParagraphElement;

  // Antag att `username` är definierad och tillgänglig i det här scopet
  if (event.playerId === currentPlayerId) {
    playerOnePoints.innerHTML = `${username} ${event.score}`;
  } else {
    playerTwoPoints.innerHTML = `Frenemy: ${event.score}`;
  }
});
  
  socket.on("gameOver", () => {
	console.log("Spelet är över!");
	gameFieldEl.style.display = "none";
	gameOverPageEl.classList.remove("hide");
  
	document.querySelector("#play-again")?.addEventListener("click", () => {
	  gameOverPageEl.classList.add("hide");
	  player1TimerEl.innerText = `00:000`;
	  player2TimerEl.innerText = `00:000`;
	  player1pEl.innerHTML = `Points: 0`;
	  player2pEl.innerHTML = `Points: 0`;
	  startPageEl.classList.remove("hide");
	});
  });
  