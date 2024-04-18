import { Game, Highscore, Player, Result, Room, VirusDelay } from "./Models";
export {};

// Events emitted by the server to the client
export interface ServerToClientEvents {
  roomCreated: (event: RoomCreatedEvent) => void;
  waitingForPlayer: (event: WaitingForPlayersEvent) => void;
  virusLogic: (position: number, delay: number) => void;
  virusDelay: (data: VirusDelay) => void;
  playerLeft: (username: string) => void;
  countdown: (seconds: number) => void;
  startGame: () => void;
  virusHitConfirmed: () => void;
  gameOver: () => void;
  gameScore: (socketId: string, playerPoints: number) => void;
  scores: (player1Score: number, player2Score: number) => void;
  opponentReactionTime: (playerId: string, elapsedTime: number) => void;
  scoreUpdate: (event: ScoreUpdateEvent) => void;
}

// Events emitted by the client to the server
export interface ClientToServerEvents {
  roomForPlayers: (callback: (rooms: Room[]) => void) => void;
  playerJoinRequest: (username: string) => void;
  highscore: (callback: (highscores: Highscore[]) => void) => void;
  virusClick: (event: stopTimerEvent) => void;
  gameScore: () => void;
  results: (callback: (results: Result[]) => void) => void;
}

export interface ScoreUpdateEvent {
  playerId: string;
  score: number;
}

export interface GameInfo extends Game {
  players: Player[];
}

export interface RoomCreatedEvent {
  gameId: string;
  players: Player[];
}

export interface WaitingForPlayersEvent {
  message: string;
}

export interface WaitingPlayers {
  players: Player;
  socketId: string;
}

export interface stopTimerEvent {
  playerId: string;
  elapsedTime: number;
}

export interface UserSocketMap {
  [username: string]: string;
}

export interface ReactionTimes {
  [playerId: string]: number[];
}

export interface AverageHighscores {
  [playerId: string]: number;
}

export interface Highscores {
  id: string;
  username: string;
  highscore: number;
}

export type Points = Record<string, number>;
