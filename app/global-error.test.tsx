import { fireEvent, render, screen } from "@testing-library/react";
import type GlobalErrorComponent from "./global-error";

const SECRET_MESSAGE = "relation private_users does not exist (dummy)";
const SECRET_STACK_FRAME = "at queryPrivateUsers (lib/services/dummy.ts:42:7)";
const DIGEST = "1234567890";

function makeError(digest?: string) {
  const error = new Error(SECRET_MESSAGE) as Error & { digest?: string };
  error.stack = `Error: ${SECRET_MESSAGE}\n    ${SECRET_STACK_FRAME}`;
  if (digest) error.digest = digest;
  return error;
}

function loadGlobalError(nodeEnv: string): typeof GlobalErrorComponent {
  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV = nodeEnv;
  const react = jest.requireActual("react");
  const jsxRuntime = jest.requireActual("react/jsx-runtime");
  let mod: { default: typeof GlobalErrorComponent } | undefined;
  // logger は読み込み時の NODE_ENV で出力先を決めるため読み直す。React は描画側と共有する。
  jest.isolateModules(() => {
    jest.doMock("react", () => react);
    jest.doMock("react/jsx-runtime", () => jsxRuntime);
    mod = require("./global-error");
  });
  if (!mod) throw new Error("global-error を読み込めませんでした");
  return mod.default;
}

describe("GlobalError", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "group").mockImplementation(() => {});
    jest.spyOn(console, "groupEnd").mockImplementation(() => {});
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV =
      originalNodeEnv;
    jest.restoreAllMocks();
  });

  describe.each(["production", "development"])("NODE_ENV=%s", (nodeEnv) => {
    it("エラーの message・name・stack を画面に出さない", () => {
      const GlobalError = loadGlobalError(nodeEnv);
      const { container } = render(
        <GlobalError error={makeError(DIGEST)} reset={jest.fn()} />,
      );

      const text = container.textContent ?? "";
      expect(text).not.toContain(SECRET_MESSAGE);
      expect(text).not.toContain(SECRET_STACK_FRAME);
      expect(text).not.toContain("Error Name");
      expect(text).not.toContain("スタックトレース");
    });

    it("利用者向けの日本語の文言と再試行ボタンを出し、押すと reset が呼ばれる", () => {
      const GlobalError = loadGlobalError(nodeEnv);
      const reset = jest.fn();
      render(<GlobalError error={makeError()} reset={reset} />);

      expect(screen.getByText("エラーが発生しました")).toBeInTheDocument();
      expect(
        screen.getByText(
          "申し訳ありません。時間をおいてもう一度お試しください。",
        ),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }));
      expect(reset).toHaveBeenCalledTimes(1);
    });
  });

  it("digest があればエラーIDとして出し、なければ出さない", () => {
    const GlobalError = loadGlobalError("production");
    const { container, rerender } = render(
      <GlobalError error={makeError(DIGEST)} reset={jest.fn()} />,
    );
    expect(container.textContent).toContain(`エラーID: ${DIGEST}`);

    rerender(<GlobalError error={makeError()} reset={jest.fn()} />);
    expect(container.textContent).not.toContain("エラーID");
  });

  it("本番では調査用に message・stack・digest をログに残す", () => {
    const GlobalError = loadGlobalError("production");
    render(<GlobalError error={makeError(DIGEST)} reset={jest.fn()} />);

    const logged = consoleError.mock.calls
      .filter(([label]) => label === "[Production Error]")
      .map(([, entry]) => JSON.parse(entry as string));
    expect(logged).toEqual([
      expect.objectContaining({
        message: SECRET_MESSAGE,
        stack: expect.stringContaining(SECRET_STACK_FRAME),
        digest: DIGEST,
        context: expect.objectContaining({ type: "global-error" }),
      }),
    ]);
  });
});
