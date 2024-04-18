import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
	// Here be all your seeds 🌱
	const game = await prisma.game.create({
        data: {
            // Include any initial data for Game if necessary
        },
    });

    // // Now `game.id` contains a valid MongoDB ObjectID that can be used for Player
    // const player1 = await prisma.player.create({
    //     data: {
    //         username: 'PlayerOne',
    //         id: Socket.id
    //     },
    // });

    // console.log('Player created: ', player1);
}


main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
