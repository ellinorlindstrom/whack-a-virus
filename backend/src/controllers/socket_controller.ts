/**
 * Socket Controller
 */
import { Server, Socket } from "socket.io";
import {
	ClientToServerEvents,
	ServerToClientEvents,
	WaitingPlayers,
	ReactionTimes,
	AverageHighscores,
} from "@shared/types/SocketTypes";
import prisma from "../prisma";
import {
	deletePlayer,
	findPlayer,
	findPlayersInGame,
	getPlayer,
} from "../services/PlayerService";
import {
	createHighscore,
	getAllHighscores,
} from "../services/HighscoreService";
import { createResult, getResults } from "../services/ResultService";

// array of players waiting to play
const waitingPlayers: WaitingPlayers[] = [];

// object of reactiontimes
const reactionTimes: ReactionTimes = {};

// initialize variables for timer state
let isGameRunning = false;
let startTime: number;
let intervalId: NodeJS.Timeout;
export { isGameRunning, startTime, intervalId };

// game variables
const maxRounds = 10;
let clicksInRound = 0;
let virusActive = false;
let virusStartTime: number;
let player1Score = 0;
let player2Score = 0;
const gameScores: Record<
	string,
	{ player1Score: number; player2Score: number }
> = {};

let socketToGameMap: Record<string, string> = {};
let gameStateMap: Record<
	string,
	{
		currentRound: number;
		clicksInRound: number;
		virusActive: boolean;
	}
> = {};

const games = new Map();
const lastClickedPlayers = new Map();

export const handleConnection = (
	socket: Socket<ClientToServerEvents, ServerToClientEvents>,
	io: Server<ClientToServerEvents, ServerToClientEvents>
) => {
	socket.on("playerJoinRequest", async (username) => {
		const existingPlayer = await prisma.player.findUnique({
			where: {
				id: socket.id,
			},
		});

		let player;

		if (existingPlayer) {
			player = existingPlayer;
		} else {
			player = await prisma.player.create({
				data: {
					id: socket.id,
					username,
				},
			});
		}

		for (const playerId in reactionTimes) {
			if (reactionTimes.hasOwnProperty(playerId)) {
				delete reactionTimes[playerId];
			}
		}

		waitingPlayers.push({
			players: {
				playerId: socket.id,
				username: username,
			},
			socketId: socket.id,
		});

		if (waitingPlayers.length >= 2) {
			const playersInRoom = waitingPlayers.splice(0, 2);

			// Create a Game in MongoDB and retrive the room/game ID
			const game = await prisma.game.create({
				data: {
					players: {
						connect: playersInRoom.map((p) => ({
							id: p.players.playerId,
						})),
					},
				},
				include: {
					players: true,
				},
			});

			let gameId = game.id;

			function initiateCountdown(
				io: Server<ClientToServerEvents, ServerToClientEvents>
			) {
				let countdown = 3;
				const countdownInterval = setInterval(() => {
					io.to(gameId).emit("countdown", countdown);
					countdown--;
					if (countdown < -1) {
						// Wait one interval after reaching 0 before clearing
						clearInterval(countdownInterval);
						setTimeout(() => {
							io.to(gameId).emit("startGame");
							startRound(io, gameId);
						}, 100);
					}
				}, 1000);
			}

			playersInRoom.forEach((player) => {
				const playerSocket = io.sockets.sockets.get(player.socketId);
				let gameId = game.id;

				if (playerSocket) {
					playerSocket.join(gameId);
					socketToGameMap[player.socketId] = gameId;
				}
			});
			io.to(gameId).emit("roomCreated", {
				gameId,
				players: playersInRoom.map((p) => p.players),
			});
			initiateCountdown(io);
		} else {
			socket.emit("waitingForPlayer", {
				message: "waiting for another player to join!",
			});
		}
	});

	function startRound(io: Server, gameId: string) {
		if (!gameStateMap[gameId]) {
			gameStateMap[gameId] = {
				currentRound: 1,
				clicksInRound: 0,
				virusActive: false,
			};
		} else {
			// Increment round or handle game continuation logic
			gameStateMap[gameId].currentRound++;
			gameStateMap[gameId].clicksInRound = 0; // Reset for new round
			gameStateMap[gameId].virusActive = true; // Ensure virus is active for new round
		}
		const newVirusDelay = virusDelay();
		const newVirusPosition = virusPosition();

		io.to(gameId).emit("virusLogic", newVirusPosition, newVirusDelay);
		virusActive = true; // Allow virus to be "hit" again
		virusStartTime = Date.now(); // Update starttime to calculate reactiontime
	}

	// random virus position
	function virusPosition(): number {
		return Math.floor(Math.random() * 25);
	}

	// random virus delay 1-10 seconds
	function virusDelay(): number {
		return Math.floor(Math.random() * 9000) + 1000;
	}

	const highscoreCalc = (playerId: string, reactionTimes: ReactionTimes) => {
		const averageHighscores: AverageHighscores = {};

		const playerTimes = reactionTimes[playerId];

		const averageTime =
			playerTimes.reduce((sum, time) => sum + time, 0) /
			playerTimes.length;

		averageHighscores[playerId] = averageTime;

		saveHighscoresToDatabase(playerId, averageHighscores);
	};

	// function for saving highscores in database
	const saveHighscoresToDatabase = async (
		playerId: string,
		highscore: AverageHighscores
	) => {
		for (const [playerId, playerHighscore] of Object.entries(highscore)) {
			const player = await getPlayer(playerId);

			if (player) {
				const username = player.username;

				if (username) {
					await createHighscore(username, playerHighscore);
				}
			}
		}
	};

	const updateScore = async (gameId: string, playerId: string) => {
		if (!games.has(gameId)) {
			games.set(gameId, new Map());
			lastClickedPlayers.set(gameId, null);
		}

		const game = games.get(gameId);

		const lastClickedPlayer = lastClickedPlayers.get(gameId);

		if (lastClickedPlayer !== playerId) {
			if (!game.has(playerId)) {
				game.set(playerId, 0);
			}
		}

		const score = game.get(playerId);
		game.set(playerId, score + 1);

		lastClickedPlayers.set(gameId, playerId);

		if (gameStateMap[gameId].currentRound >= maxRounds) {
			matchResult(game);
		}

		io.to(gameId).emit("scoreUpdate", {
			playerId: socket.id,
			score: game.get(playerId),
		});
	};

	const matchResult = async (game: any) => {
		const playerIds = Array.from(game.keys());

		const playerId1 = playerIds[0] as string;
		const playerId2 = playerIds[1] as string;

		const player1 = await getPlayer(playerId1);
		console.log("player1 name: ", player1?.username);

		// if (playerId2 !== undefined) {
		const player2 = await getPlayer(playerId2);
		console.log("player2 name: ", player2?.username);
		// }

		const matchResult = {
			player1: player2?.username ?? "",
			player2: player1?.username ?? "",
			player1Score: 0,
			player2Score: 0,
		};

		for (const [playerId, score] of game) {
			if (playerId === playerId1) {
				matchResult.player1Score = score;
			} else if (playerId === playerId2) {
				matchResult.player2Score = score;
			}
		}

		await createResult(matchResult);
	};

	socket.on("results", async (callback) => {
		const allResults = await getResults();
		callback(allResults);
	});

	// handling a virus hit from a client
	socket.on("virusClick", async ({ elapsedTime }) => {
		console.log("elapsedTime: ", elapsedTime);
		const playerId: string = socket.id;
		const gameId = socketToGameMap[socket.id];
		if (gameId) {
			io.to(gameId).emit("opponentReactionTime", playerId, elapsedTime);
		}
		if (!gameId || !gameStateMap[gameId]) {
			return;
		}

		if (!reactionTimes[playerId]) {
			reactionTimes[playerId] = [];
		}
		(reactionTimes[playerId] as number[]).push(elapsedTime);

		const playerIds = Object.keys(reactionTimes);

		const allPlayersHaveEnoughEntries = playerIds.every(
			(id) => reactionTimes[id].length >= 10
		);

		if (allPlayersHaveEnoughEntries) {
			for (const playerId of playerIds) {
				// Call highscoreCalc for each player
				highscoreCalc(playerId, reactionTimes);
			}
		}

		clicksInRound++;
		if (clicksInRound === 2) {

			// kolla så att en har klickat i alla fall isf 
			if (elapsedTime < 30000) {
				updateScore(gameId, playerId);
			}

			const players = await findPlayersInGame(gameId);

			if (players) {
				const player1 = players.players[0].id;
				const player2 = players.players[1].id;
			}

			clicksInRound = 0;
			if (gameStateMap[gameId].currentRound >= maxRounds) {
				gameStateMap[gameId].currentRound = 0;
				io.to(gameId).emit("gameOver");
			} else {
				// Proceed to the next round
				startRound(io, gameId);
			}
		}
	});

	socket.on("highscore", async (callback) => {
		const allHighscores = await getAllHighscores();
		callback(allHighscores);
	});

	// handler for disconnecting
	socket.on("disconnect", async () => {
		player1Score = 0;
		player2Score = 0;
		// Find player to know what room that player was in
		const player = await getPlayer(socket.id);

		// If player does not exist, the return
		if (!player) {
			return;
		}

		// Find and remove the player from the room in MongoDB
		if (player.gameId) {
			const updatePlayer = await prisma.game.update({
				where: {
					id: player.gameId,
				},
				data: {
					players: {
						disconnect: {
							id: socket.id,
						},
					},
				},
			});

			const playerLeftInRoom = await findPlayer(player.gameId);

			// Remove player after he plays
			const deletedPlayer = await deletePlayer(socket.id);

			io.to(player.gameId).emit("playerLeft", player.username);
		}
	});
};
