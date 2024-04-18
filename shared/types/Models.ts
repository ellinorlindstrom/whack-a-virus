export {};

export interface Game {
  id: string;
  name: string;
}

export interface Room {
  roomId: string;
  players: Player[];
}

export interface Player {
  playerId: string;
  username: string;
}

export interface Highscore {
  username: string;
  highscore: number;
}

export interface Result {
  id: string;
  player1: string;
  player2: string;
  player1Score: number;
  player2Score: number;
}

export interface VirusPosition {
  position: number;
}

export interface VirusDelay {
  delay: number;
}

export type StartGame = {
  virusPosition: number;
  virusDelay: number;
};
