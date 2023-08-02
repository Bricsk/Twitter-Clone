/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Import necessary dependencies and types
import { type Prisma } from "@prisma/client"; // Importing the Prisma type
import { type inferAsyncReturnType } from "@trpc/server"; // Importing a specific type from the "@trpc/server" library
import { z } from "zod"; // Importing the "z" library
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  type createTRPCContext,
} from "~/server/api/trpc"; // Importing various functions and types from "~/server/api/trpc" module

// Create a tweetRouter using TRPC (The Realtime GraphQL for TypeScript)
export const tweetRouter = createTRPCRouter({
  infiniteProfileFeed: publicProcedure
    .input(
      // Specify the input shape using Zod (a schema definition library)
      z.object({
        userId: z.string(), // Optional boolean flag to filter tweets from only following users
        limit: z.number().optional(), // Optional number to limit the number of tweets returned
        cursor: z.object({ id: z.string(), createdAt: z.date() }).optional(), // Optional cursor object to fetch tweets from a specific point
      })
    )
    .query(
      async ({ input: { limit = 10, userId, cursor }, ctx }) => {
        return await getInfiniteTweets({
          limit,
          ctx,
          cursor,
          whereClause: {
            userId,
          },
        });
      }
    ),

  // Define a procedure called "infiniteFeed" for public access (read-only)
  infiniteFeed: publicProcedure
    .input(
      // Specify the input shape using Zod (a schema definition library)
      z.object({
        onlyFollowing: z.boolean().optional(), // Optional boolean flag to filter tweets from only following users
        limit: z.number().optional(), // Optional number to limit the number of tweets returned
        cursor: z.object({ id: z.string(), createdAt: z.date() }).optional(), // Optional cursor object to fetch tweets from a specific point
      })
    )
    .query(
      // Implement the procedure's query function
      async ({ input: { limit = 10, onlyFollowing = false, cursor }, ctx }) => {
        // Extract the current user's ID from the session
        const currentUserId = ctx.session?.user.id;

        // Call the "getInfiniteTweets" function to fetch tweets
        return await getInfiniteTweets({
          limit,
          ctx,
          cursor,
          // Use a "whereClause" to filter tweets based on whether the user follows others or not
          whereClause:
            currentUserId == null || !onlyFollowing
              ? undefined
              : {
                  user: {
                    followers: { some: { id: currentUserId } },
                  },
                },
        });
      }
    ),

  // Define a procedure called "create" for protected access (requires authentication)
  create: protectedProcedure
    .input(z.object({ content: z.string() })) // Define the input shape for creating a tweet
    .mutation(async ({ input: { content }, ctx }) => {
      // Create a new tweet using the Prisma ORM and the authenticated user's ID
      const tweet = await ctx.prisma.tweet.create({
        data: { content, userId: ctx.session.user.id },
      });
      return tweet; // Return the created tweet
    }),

  // Define a procedure called "toggleLike" for protected access
  toggleLike: protectedProcedure
    .input(z.object({ id: z.string() })) // Define the input shape for toggling a tweet's like
    .mutation(async ({ input: { id }, ctx }) => {
      // Check if the user already liked the tweet using the Prisma ORM
      const data = { tweetId: id, userId: ctx.session.user.id };
      const existingLike = await ctx.prisma.like.findUnique({
        where: { userId_tweetId: data },
      });

      // If the user hasn't liked the tweet, create a new like and return { addedLike: true }
      // Otherwise, delete the existing like and return { addedLike: false }
      if (existingLike == null) {
        await ctx.prisma.like.create({ data });
        return { addedLike: true };
      } else {
        await ctx.prisma.like.delete({ where: { userId_tweetId: data } });
        return { addedLike: false };
      }
    }),
});

// Define the interface for the properties passed to "getInfiniteTweets" function
interface getInfiniteTweetsProps {
  whereClause?: Prisma.TweetWhereInput; // Optional filtering criteria for tweets
  limit: number; // The maximum number of tweets to fetch
  cursor: { id: string; createdAt: Date } | undefined; // Cursor to fetch tweets from a specific point
  ctx: inferAsyncReturnType<typeof createTRPCContext>; // The context passed to the procedure's query function
}

// Function to fetch an infinite number of tweets based on the provided input
async function getInfiniteTweets({
  whereClause,
  ctx,
  limit,
  cursor,
}: getInfiniteTweetsProps) {
  // Extract the current user's ID from the session
  const currentUserId = ctx.session?.user.id;

  // Fetch tweets from the database using Prisma based on the provided input
  const data = await ctx.prisma.tweet.findMany({
    take: limit + 1, // Fetch one extra tweet to determine if there are more tweets available
    cursor: cursor ? { createdAt_id: cursor } : undefined, // Use the cursor to fetch tweets from a specific point
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], // Order tweets by creation date and ID (descending)
    where: whereClause, // Apply the optional filtering criteria to fetch specific tweets
    select: {
      id: true,
      content: true,
      createdAt: true,
      _count: { select: { Likes: true } }, // Fetch the count of likes for each tweet
      Likes:
        currentUserId == null ? false : { where: { userId: currentUserId } }, // Check if the current user has liked each tweet
      user: {
        select: { name: true, id: true, image: true }, // Select specific user properties to fetch
      },
    },
  });

  // Determine the next cursor if there are more tweets available than the limit
  let nextCursor: typeof cursor | undefined;
  if (data.length > limit) {
    const nextItem = data.pop();
    if (nextItem != null) {
      nextCursor = { id: nextItem.id, createdAt: nextItem.createdAt };
    }
  }

  // Transform and return the fetched tweet data
  return {
    tweets: data.map((tweet) => {
      return {
        id: tweet.id,
        content: tweet.content,
        createdAt: tweet.createdAt,
        likeCount: tweet._count.Likes,
        user: tweet.user,
        likedByMe: tweet.Likes?.length > 0,
      };
    }),
    nextCursor, // Return the next cursor for pagination purposes
  };
}
