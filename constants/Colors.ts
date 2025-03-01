/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const spotifyGreen = '#1DB954';
const spotifyBlack = '#191414';
const spotifyWhite = '#FFFFFF';
const spotifyGray = '#B3B3B3';

export const Colors = {
  light: {
    text: spotifyBlack,
    background: spotifyWhite,
    tint: spotifyGreen,
    icon: spotifyGray,
    tabIconDefault: spotifyGray,
    tabIconSelected: spotifyGreen,
  },
  dark: {
    text: spotifyWhite,
    background: spotifyBlack,
    tint: spotifyGreen,
    icon: spotifyGray,
    tabIconDefault: spotifyGray,
    tabIconSelected: spotifyGreen,
  },
};
