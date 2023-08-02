/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import React from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import ProfileImage from "./ProfileImage";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { VscHeartFilled, VscHeart } from "react-icons/vsc";
import IconHoverEffect from "./IconHoverEffect";
import { api } from "~/utils/api";
import { LoadingSpinner } from "./LoadingSpinner";

// Define a Tweet interface with specific properties representing a tweet.
// It has an id, content, createdAt (date), likeCount (number), likedByMe (boolean),
// and user information with an id, image (string or null), and name (string or null).
interface Tweet {
  id: string;
  content: string;
  createdAt: Date;
  likeCount: number;
  likedByMe: boolean;
  user: { id: string; image: string | null; name: string | null };
}

// Define an interface for props of the InfiniteTweetList component.
// It contains isLoading (boolean), isError (boolean or undefined),
// hasMore (boolean or undefined), fetchNewTweets (a function returning a Promise),
// and an optional tweets array of type Tweet[].
interface InfiniteTweetListProps {
  isLoading: boolean;
  isError: boolean | undefined;
  hasMore: boolean | undefined;
  fetchNewTweets: () => Promise<unknown>;
  tweets?: Tweet[];
}

// Define an interface for props of the HeartButton component.
// It contains isLoading (boolean), onClick (a function), likedByMe (boolean),
// and likeCount (number).
interface HeartButtonProps {
  isLoading: boolean;
  onClick: () => void;
  likedByMe: boolean;
  likeCount: number;
}

// Export the InfiniteTweetList component as the default export.
// This component receives props defined in InfiniteTweetListProps.
export default function InfiniteTweetList({
  tweets,
  isError,
  isLoading,
  fetchNewTweets,
  hasMore = false,
}: InfiniteTweetListProps) {
  // If the component is loading, display a LoadingSpinner component.
  if (isLoading) {<LoadingSpinner />;}

  // If there's an error, display an error message.
  if (isError) <h1>Error...</h1>;

  // If there are no tweets or tweets is null, return null.
  if (tweets == null) return null;

  // If there are no tweets or the tweets array is empty, display "No Tweets" message.
  if (tweets == null || tweets.length === 0) {
    return (
      <h2 className="my-4 text-center text-2xl text-gray-500">No Tweets</h2>
    );
  }

  // Render an unordered list with InfiniteScroll for displaying the tweets.
  // InfiniteScroll loads more tweets when the user reaches the bottom of the list.
  return (
    <ul>
      <InfiniteScroll
        dataLength={tweets.length}
        next={fetchNewTweets}
        hasMore={hasMore}
        loader={<LoadingSpinner />}
      >
        {/* Map through each tweet and render a TweetCard component for each tweet. */}
        {tweets.map((tweet) => {
          return <TweetCard key={tweet.id} {...tweet} />;
        })}
      </InfiniteScroll>
    </ul>
  );
}

// Create a date time formatter for the TweetCard component to format createdAt date.
const dateTimeFormatter = Intl.DateTimeFormat(undefined, { dateStyle: "long" });

// TweetCard component displays an individual tweet in a list.
// It receives a tweet object as props of type Tweet.
function TweetCard({
  id,
  user,
  content,
  createdAt,
  likeCount,
  likedByMe,
}: Tweet) {
  // Some API utility hooks are used inside the TweetCard component.
  // It uses the `api` object to fetch and toggle tweet likes.
  const trcpUtils = api.useContext();
  const toggleLike = api.tweet.toggleLike.useMutation({
    // When a tweet is liked or unliked, update the likeCount and likedByMe properties.
    onSuccess: ({ addedLike }) => {
      const updateData: Parameters<
        typeof trcpUtils.tweet.infiniteFeed.setInfiniteData
      >[1] = (oldData) => {
        if (oldData == null) return;

        const countModifier = addedLike ? 1 : -1;

        return {
          ...oldData,
          pages: oldData.pages.map((page) => {
            return {
              ...page,
              tweets: page.tweets.map((tweet) => {
                if (tweet.id === id) {
                  return {
                    ...tweet,
                    likeCount: tweet.likeCount + countModifier,
                    likedByMe: addedLike,
                  };
                }

                return tweet;
              }),
            };
          }),
        };
      };

      // Call the utility function to update the tweet's likeCount and likedByMe properties.
      trcpUtils.tweet.infiniteFeed.setInfiniteData({}, updateData);
      trcpUtils.tweet.infiniteFeed.setInfiniteData({onlyFollowing: true}, updateData);
      trcpUtils.tweet.infiniteProfileFeed.setInfiniteData({userId: user.id}, updateData);

    },
  });

  // Function to handle toggling like on the tweet.
  function handleToggleLike() {
    toggleLike.mutate({ id });
  }

  // Render the individual tweet card.
  return (
    <li className="flex gap-4 border-b px-4 py-4">
      {/* Link to the user's profile */}
      <Link href={`/profiles/${user.id}`}>
        <ProfileImage src={user.image}></ProfileImage>
      </Link>
      <div className="flex flex-grow flex-col">
        <div className="flex gap-1">
          {/* Link to the user's profile */}
          <Link
            href={`/profiles/${user.id}`}
            className="font-bold outline-none hover:underline focus-visible:underline"
          >
            {user.name}
          </Link>
          <span className="text-gray-500">-</span>
          <span className="text-gray-500">
            {dateTimeFormatter.format(createdAt)}
          </span>
        </div>
        {/* Display the tweet content */}
        <p className="whitespace-pre-wrap">{content}</p>
        {/* Render the HeartButton component */}
        <HeartButton
          onClick={handleToggleLike}
          isLoading={toggleLike.isLoading}
          likedByMe={likedByMe}
          likeCount={likeCount}
        />
      </div>
    </li>
  );
}

// HeartButton component represents a button to like/unlike a tweet.
// It receives props related to the like status and count of the tweet.
function HeartButton({
  likedByMe,
  likeCount,
  isLoading,
  onClick,
}: HeartButtonProps) {
  // Use the session to check if the user is authenticated or not.
  const session = useSession();
  // Choose the HeartIcon based on whether the tweet is liked or not.
  const HeartIcon = likedByMe ? VscHeartFilled : VscHeart;

  // If the user is not authenticated, show the like count with a gray heart icon.
  if (session.status !== "authenticated") {
    return (
      <div className="mb-1 mt-1 flex items-center gap-3 self-start text-gray-500">
        <HeartIcon />
        <span>{likeCount}</span>
      </div>
    );
  }

  // If the user is authenticated, show a button that toggles the like status.
  return (
    <button
      disabled={isLoading}
      onClick={onClick}
      className={`group -ml-2 flex items-center gap-1 self-start outline-none transition-colors duration-200 ${
        likedByMe
          ? "text-red-500"
          : "text-gray-500 hover:text-red-500 focus-visible:text-red-500"
      }`}
    >
      <IconHoverEffect red>
        {/* Show a filled red heart if the tweet is liked; otherwise, show an outline heart. */}
        <HeartIcon
          className={`transition-colors duration-200 ${
            likedByMe
              ? "fill-red-500"
              : "fill-gray-500 group-hover:fill-red-500 group-focus-visible:fill-red-500"
          }`}
        />
      </IconHoverEffect>
      {/* Show the like count */}
      <span>{likeCount}</span>
    </button>
  );
}
