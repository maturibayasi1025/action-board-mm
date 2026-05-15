/** アクションボード Web のベース URL（末尾スラッシュなし推奨）。`.env` の EXPO_PUBLIC_ACTION_BOARD_URL から注入。 */
const actionBoardUrl =
  process.env.EXPO_PUBLIC_ACTION_BOARD_URL ?? "http://localhost:3000";

export default {
  name: "Action Board",
  slug: "action-board-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.maisonmarc.actionboard",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.maisonmarc.actionboard",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: {
    actionBoardUrl,
    eas: {
      projectId: "f90c4dc3-0e38-4782-91d2-7e5b60afb368",
    },
  },
};
