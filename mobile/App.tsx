import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { WebView as WebViewType } from "react-native-webview";
import { WebView } from "react-native-webview";

const safeAreaEdges = ["top", "right", "bottom", "left"] as const;

/** 利用可能幅に対する割合（小さいほど左右に余白） */
const WEBVIEW_WIDTH_RATIO = 0.88;
/** 大画面で横に伸びすぎないようキャップ（dp） */
const WEBVIEW_MAX_WIDTH = 400;

function getStartUrl(): string {
  const extra = Constants.expoConfig?.extra as
    | { actionBoardUrl?: string }
    | undefined;
  const fromExtra = extra?.actionBoardUrl;
  if (typeof fromExtra === "string" && fromExtra.length > 0) {
    return fromExtra;
  }
  const fromEnv = process.env.EXPO_PUBLIC_ACTION_BOARD_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv;
  }
  return "http://localhost:3000";
}

function WebShell({ uri }: { uri: string }) {
  const webViewRef = useRef<WebViewType>(null);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const innerWidth = screenWidth - insets.left - insets.right;
  const webViewWidth = useMemo(
    () => Math.min(innerWidth * WEBVIEW_WIDTH_RATIO, WEBVIEW_MAX_WIDTH),
    [innerWidth],
  );

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  if (error) {
    return (
      <View style={styles.webShell}>
        <View style={[styles.webColumn, { width: webViewWidth }]}>
          <View style={styles.errorInner}>
            <Text style={styles.errorTitle}>読み込みに失敗しました</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Text style={styles.urlHint}>URL: {uri}</Text>
            <Text style={styles.help}>
              実機からローカル Next.js を見る場合は、PCのLANアドレスを
              EXPO_PUBLIC_ACTION_BOARD_URL に設定してください。Android
              エミュレータでは 10.0.2.2:3000 がホストの localhost に相当します。
            </Text>
            <Pressable
              onPress={handleRetry}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonLabel}>再試行</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.webShell}>
      <View style={[styles.webColumn, { width: webViewWidth }]}>
        <WebView
          ref={webViewRef}
          source={{ uri }}
          style={styles.fill}
          onLoadStart={() => {
            setLoading(true);
            setError(null);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={(e) =>
            setError(e.nativeEvent.description || "WebView エラー")
          }
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsBackForwardNavigationGestures
          originWhitelist={["*"]}
          setSupportMultipleWindows={false}
        />
        {loading && (
          <View style={styles.loaderOverlay} pointerEvents="none">
            <ActivityIndicator size="large" />
          </View>
        )}
      </View>
    </View>
  );
}

export default function App() {
  const uri = useMemo(() => getStartUrl(), []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.fill} edges={safeAreaEdges}>
        <StatusBar style="dark" />
        <WebShell uri={uri} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: "#fff",
  },
  webShell: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#e8e8e8",
  },
  webColumn: {
    flex: 1,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  errorInner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
    backgroundColor: "#fff",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorBody: {
    fontSize: 15,
    color: "#444",
    marginBottom: 12,
  },
  urlHint: {
    fontSize: 13,
    fontFamily: "monospace",
    marginBottom: 12,
    color: "#666",
  },
  help: {
    fontSize: 13,
    lineHeight: 20,
    color: "#666",
    marginBottom: 24,
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#111",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});
