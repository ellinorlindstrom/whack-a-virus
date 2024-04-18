/**
 * Service for results
 */
import prisma from "../prisma";

export const createResult = (matchResult: any) => {
	return prisma.result.create({
		data: {
			player1: matchResult.player1,
			player2: matchResult.player2,
			player1Score: matchResult.player1Score,
			player2Score: matchResult.player2Score,
		},
	});
};

export const getResults = () => {
	return prisma.result.findMany({
		orderBy: {
			createdAt: "desc",
		},
	});
};
