/**
 * Service for highscore
 */
import prisma from "../prisma";

export const getAllHighscores = () => {
	return prisma.highScore.findMany({
		orderBy: {
			highscore: "asc",
		},
	});
};

export const createHighscore = (username: string, highscore: number) => {
	return prisma.highScore.create({
		data: {
			username: username,
			highscore: highscore,
		},
	});
};
