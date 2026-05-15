import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { WebView as WebViewType } from "react-native-webview";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview/lib/WebViewTypes";

const safeAreaEdges = ["top", "right", "bottom", "left"] as const;

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
  const canGoBackRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
    setCanGoBack(nav.canGoBack);
    setCanGoForward(nav.canGoForward);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBackRef.current) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  const goBack = useCallback(() => {
    webViewRef.current?.goBack();
  }, []);

  const goForward = useCallback(() => {
    webViewRef.current?.goForward();
  }, []);

  if (error) {
    return (
      <View style={styles.errorOuter}>
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
    );
  }

  return (
    <View style={styles.fill}>
      <View style={styles.toolbar} accessibilityRole="toolbar">
        <Pressable
          onPress={goBack}
          disabled={!canGoBack}
          style={({ pressed }) => [
            styles.toolbarButton,
            !canGoBack && styles.toolbarButtonDisabled,
            pressed && canGoBack && styles.toolbarButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Webページを戻る"
        >
          <Text
            style={[
              styles.toolbarButtonLabel,
              !canGoBack && styles.toolbarButtonLabelDisabled,
            ]}
          >
            戻る
          </Text>
        </Pressable>
        <Pressable
          onPress={goForward}
          disabled={!canGoForward}
          style={({ pressed }) => [
            styles.toolbarButton,
            !canGoForward && styles.toolbarButtonDisabled,
            pressed && canGoForward && styles.toolbarButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Webページを進む"
        >
          <Text
            style={[
              styles.toolbarButtonLabel,
              !canGoForward && styles.toolbarButtonLabelDisabled,
            ]}
          >
            進む
          </Text>
        </Pressable>
      </View>
      <View style={styles.webViewWrap}>
        <WebView
          ref={webViewRef}
          source={{ uri }}
          style={styles.webView}
          onNavigationStateChange={onNavigationStateChange}
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
  webView: {
    flex: 1,
    backgroundColor: "#fff",
  },
  webViewWrap: {
    flex: 1,
    position: "relative",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f5f5f5",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
  },
  toolbarButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#bbb",
  },
  toolbarButtonPressed: {
    opacity: 0.85,
    backgroundColor: "#eee",
  },
  toolbarButtonDisabled: {
    opacity: 0.45,
    backgroundColor: "#f0f0f0",
    borderColor: "#ddd",
  },
  toolbarButtonLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },
  toolbarButtonLabelDisabled: {
    color: "#888",
  },
  errorOuter: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    justifyContent: "center",
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
